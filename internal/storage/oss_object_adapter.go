package storage

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	ossSDK "github.com/aliyun/aliyun-oss-go-sdk/oss"
)

// NewObjectAdapter decorates the S3 object API with OSS-specific behavior.
func newOSSObjectAdapter(base ObjectAdapter, client *ossSDK.Client, creds Credentials) ObjectAdapter {
	return &ossObjectAdapter{
		ObjectAdapter: base,
		client:        client,
		creds:         creds,
	}
}

type ossObjectAdapter struct {
	ObjectAdapter
	client *ossSDK.Client
	creds  Credentials
}

func (o *ossObjectAdapter) ListObjects(ctx context.Context, input ListObjectsInput) (ListObjectsResult, error) {
	var result ListObjectsResult
	bucketName := strings.TrimSpace(input.Bucket)
	logger := log.With().
		Str("component", "oss.ListObjects").
		Str("bucket", bucketName).
		Logger()
	if bucketName == "" {
		logger.Warn().Msg("Bucket name is empty")
		return result, errors.New("bucket is required")
	}

	var bucket *ossSDK.Bucket
	var err error

	// Optimization: If region is provided by frontend, use it to resolve endpoint immediately
	if input.Region != "" {
		if ep := endpointFromRegion(input.Region, o.creds.UseSSL); ep != "" {
			var altClient *ossSDK.Client
			altClient, err = ossSDK.New(ep, o.creds.AccessKeyID, o.creds.SecretAccessKey)
			if err == nil {
				bucket, err = altClient.Bucket(bucketName)
			}
		}
	}

	// Fallback to default client if no region provided or error
	if bucket == nil {
		bucket, err = o.client.Bucket(bucketName)
	}

	if err != nil {
		logger.Error().Err(err).Msg("Failed to get bucket instance")
		return result, err
	}

	var options []ossSDK.Option
	if input.Prefix != "" {
		options = append(options, ossSDK.Prefix(input.Prefix))
	}
	if input.Delimiter != "" {
		options = append(options, ossSDK.Delimiter(input.Delimiter))
	}
	if input.Marker != "" {
		options = append(options, ossSDK.ContinuationToken(input.Marker))
	}
	if input.Limit > 0 {
		options = append(options, ossSDK.MaxKeys(input.Limit))
	}

	out, err := bucket.ListObjectsV2(options...)
	if err != nil {
		logger.Warn().Err(err).Msg("ListObjectsV2 failed, attempting endpoint recovery")
		out, err = o.retryListObjectsWithAlternateEndpoint(ctx, bucketName, options, err, logger)
		if err != nil {
			logger.Error().Err(err).Msg("ListObjectsV2 failed after retry")
			return result, err
		}
	}
	logger.Debug().
		Int("objects", len(out.Objects)).
		Int("prefixes", len(out.CommonPrefixes)).
		Bool("truncated", out.IsTruncated).
		Msg("ListObjectsV2 succeeded")

	entries := make([]ObjectDescriptor, 0, len(out.CommonPrefixes)+len(out.Objects))

	for _, prefix := range out.CommonPrefixes {
		entries = append(entries, ObjectDescriptor{
			Key:   prefix,
			IsDir: true,
		})
	}

	for _, obj := range out.Objects {
		entries = append(entries, ObjectDescriptor{
			Key:          obj.Key,
			Size:         obj.Size,
			LastModified: obj.LastModified,
			ETag:         strings.Trim(obj.ETag, `"`),
			StorageClass: obj.StorageClass,
			IsDir:        false,
		})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return entries[i].Key < entries[j].Key
	})

	result.Objects = entries
	result.Truncated = out.IsTruncated
	result.NextMarker = out.NextContinuationToken

	return result, nil
}

func (o *ossObjectAdapter) retryListObjectsWithAlternateEndpoint(
	ctx context.Context,
	bucketName string,
	options []ossSDK.Option,
	originalErr error,
	logger zerolog.Logger,
) (ossSDK.ListObjectsResultV2, error) {
	var empty ossSDK.ListObjectsResultV2
	if !isEndpointMismatchError(originalErr) {
		return empty, originalErr
	}

	endpoint, resolveErr := o.resolveAlternateEndpoint(ctx, bucketName, originalErr)
	if resolveErr != nil {
		logger.Warn().Err(resolveErr).Msg("Failed to resolve alternate endpoint")
		return empty, resolveErr
	}
	if endpoint == "" {
		return empty, originalErr
	}

	altClient, err := ossSDK.New(endpoint, o.creds.AccessKeyID, o.creds.SecretAccessKey)
	if err != nil {
		return empty, err
	}

	retryBucket, err := altClient.Bucket(bucketName)
	if err != nil {
		return empty, err
	}

	logger.Info().Str("endpoint", endpoint).Msg("Retrying ListObjectsV2 with alternate endpoint")
	return retryBucket.ListObjectsV2(options...)
}

func (o *ossObjectAdapter) resolveAlternateEndpoint(
	ctx context.Context,
	bucketName string,
	originalErr error,
) (string, error) {
	if endpoint := endpointFromServiceError(originalErr, o.creds.UseSSL); endpoint != "" {
		return endpoint, nil
	}
	if endpoint := endpointFromRegion(o.creds.Region, o.creds.UseSSL); endpoint != "" {
		return endpoint, nil
	}

	location, err := o.lookupBucketLocation(ctx, bucketName)
	if err != nil {
		return "", err
	}
	if location == "" {
		return "", fmt.Errorf("oss: unable to resolve endpoint for bucket %s; please configure the correct region or endpoint", bucketName)
	}
	return normalizeOSSEndpoint(location, o.creds.UseSSL), nil
}

func (o *ossObjectAdapter) lookupBucketLocation(ctx context.Context, bucketName string) (string, error) {
	const pageSize = 100
	marker := ""
	for {
		if err := ctx.Err(); err != nil {
			return "", err
		}

		opts := []ossSDK.Option{ossSDK.MaxKeys(pageSize)}
		if marker != "" {
			opts = append(opts, ossSDK.Marker(marker))
		}

		listResult, err := o.client.ListBuckets(opts...)
		if err != nil {
			if isAccessDenied(err) {
				return "", fmt.Errorf("oss: access denied when discovering endpoint for bucket %s; please configure the correct region or grant oss:ListBuckets", bucketName)
			}
			return "", err
		}

		for _, bucket := range listResult.Buckets {
			if bucket.Name == bucketName {
				location := strings.TrimSpace(bucket.Location)
				if location == "" {
					location = strings.TrimSpace(bucket.Region)
				}
				if location == "" {
					return "", fmt.Errorf("oss: bucket %s location is empty; please configure region manually", bucketName)
				}
				return location, nil
			}
		}

		if !listResult.IsTruncated || listResult.NextMarker == "" {
			break
		}
		marker = listResult.NextMarker
	}

	return "", fmt.Errorf("oss: bucket %s was not found when discovering location; please configure the correct endpoint", bucketName)
}

func (o *ossObjectAdapter) CreateSymlink(ctx context.Context, bucketName, key, target string) error {
	bucket, err := o.client.Bucket(bucketName)
	if err != nil {
		return err
	}
	return bucket.PutSymlink(key, target)
}

func (o *ossObjectAdapter) GetSymlink(ctx context.Context, bucketName, key string) (string, error) {
	bucket, err := o.client.Bucket(bucketName)
	if err != nil {
		return "", err
	}
	header, err := bucket.GetSymlink(key)
	if err != nil {
		return "", err
	}
	return header.Get("x-oss-symlink-target"), nil
}

func endpointFromServiceError(err error, useSSL bool) string {
	serviceErr, ok := asServiceError(err)
	if !ok {
		return ""
	}
	return normalizeOSSEndpoint(serviceErr.Endpoint, useSSL)
}

func endpointFromRegion(region string, useSSL bool) string {
	region = strings.TrimSpace(region)
	if region == "" {
		return ""
	}
	host := region
	if !strings.HasPrefix(host, "oss-") {
		host = "oss-" + host
	}
	return normalizeOSSEndpoint(host, useSSL)
}

func normalizeOSSEndpoint(endpoint string, useSSL bool) string {
	host := strings.TrimSpace(endpoint)
	if host == "" {
		return ""
	}
	host = strings.TrimSuffix(host, "/")
	if strings.Contains(host, "://") {
		return host
	}
	if !strings.Contains(host, ".") {
		host = host + ".aliyuncs.com"
	}
	protocol := "https"
	if !useSSL {
		protocol = "http"
	}
	return fmt.Sprintf("%s://%s", protocol, host)
}

func isEndpointMismatchError(err error) bool {
	serviceErr, ok := asServiceError(err)
	if !ok {
		return false
	}
	if serviceErr.Code != "AccessDenied" {
		return false
	}
	if strings.Contains(serviceErr.Message, "must be addressed using the specified endpoint") {
		return true
	}
	return strings.TrimSpace(serviceErr.Endpoint) != ""
}

func isAccessDenied(err error) bool {
	serviceErr, ok := asServiceError(err)
	if !ok {
		return false
	}
	return serviceErr.Code == "AccessDenied"
}

func asServiceError(err error) (*ossSDK.ServiceError, bool) {
	if err == nil {
		return nil, false
	}
	var ptr *ossSDK.ServiceError
	if errors.As(err, &ptr) && ptr != nil {
		return ptr, true
	}
	var value ossSDK.ServiceError
	if errors.As(err, &value) {
		return &value, true
	}
	return nil, false
}
