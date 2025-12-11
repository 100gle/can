package oss

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strings"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"

	"can/internal/storage"
)

func (o *objectAdapter) ListObjects(ctx context.Context, input storage.ListObjectsInput) (storage.ListObjectsResult, error) {
	var result storage.ListObjectsResult
	bucketName := strings.TrimSpace(input.Bucket)
	logger := slog.With("component", "oss.ListObjects", "bucket", bucketName)
	if bucketName == "" {
		logger.Warn("Bucket name is empty")
		return result, errors.New("bucket is required")
	}

	bucket, err := o.client.Bucket(bucketName)
	if err != nil {
		logger.Error("Failed to get bucket instance", "error", err)
		return result, err
	}

	// Prefer ListObjectsV2
	var options []oss.Option
	if input.Prefix != "" {
		options = append(options, oss.Prefix(input.Prefix))
	}
	if input.Delimiter != "" {
		options = append(options, oss.Delimiter(input.Delimiter))
	}
	if input.Marker != "" {
		options = append(options, oss.ContinuationToken(input.Marker))
	}
	if input.Limit > 0 {
		options = append(options, oss.MaxKeys(input.Limit))
	}

	// Using ListObjectsV2 for consistency with S3 V2 semantics (ContinuationToken)
	out, err := bucket.ListObjectsV2(options...)
	if err != nil {
		logger.Warn("ListObjectsV2 failed, attempting endpoint recovery", "error", err)
		out, err = o.retryListObjectsWithAlternateEndpoint(ctx, bucketName, options, err, logger)
		if err != nil {
			logger.Error("ListObjectsV2 failed after retry", "error", err)
			return result, err
		}
	}
	logger.Debug("ListObjectsV2 succeeded", "objects", len(out.Objects), "prefixes", len(out.CommonPrefixes), "truncated", out.IsTruncated)

	entries := make([]storage.ObjectDescriptor, 0, len(out.CommonPrefixes)+len(out.Objects))

	// Folders (CommonPrefixes)
	for _, prefix := range out.CommonPrefixes {
		// OSS CommonPrefix is already the directory name
		entries = append(entries, storage.ObjectDescriptor{
			Key:   prefix,
			IsDir: true,
		})
	}

	// Objects
	for _, obj := range out.Objects {
		entries = append(entries, storage.ObjectDescriptor{
			Key:          obj.Key,
			Size:         obj.Size,
			LastModified: obj.LastModified,
			ETag:         strings.Trim(obj.ETag, `"`),
			StorageClass: obj.StorageClass,
			IsDir:        false,
		})
	}

	// Sort: Folders first, then files alphabetically
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

func (o *objectAdapter) retryListObjectsWithAlternateEndpoint(
	ctx context.Context,
	bucketName string,
	options []oss.Option,
	originalErr error,
	logger *slog.Logger,
) (oss.ListObjectsResultV2, error) {
	var empty oss.ListObjectsResultV2
	if !isEndpointMismatchError(originalErr) {
		return empty, originalErr
	}

	endpoint, resolveErr := o.resolveAlternateEndpoint(ctx, bucketName, originalErr)
	if resolveErr != nil {
		logger.Warn("Failed to resolve alternate endpoint", "error", resolveErr)
		return empty, resolveErr
	}
	if endpoint == "" {
		return empty, originalErr
	}

	altClient, err := oss.New(endpoint, o.creds.AccessKeyID, o.creds.SecretAccessKey)
	if err != nil {
		return empty, err
	}

	retryBucket, err := altClient.Bucket(bucketName)
	if err != nil {
		return empty, err
	}

	logger.Info("Retrying ListObjectsV2 with alternate endpoint", "endpoint", endpoint)
	return retryBucket.ListObjectsV2(options...)
}

func (o *objectAdapter) resolveAlternateEndpoint(
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
	return normalizeEndpoint(location, o.creds.UseSSL), nil
}

func (o *objectAdapter) lookupBucketLocation(ctx context.Context, bucketName string) (string, error) {
	const pageSize = 100
	marker := ""
	for {
		if err := ctx.Err(); err != nil {
			return "", err
		}

		opts := []oss.Option{oss.MaxKeys(pageSize)}
		if marker != "" {
			opts = append(opts, oss.Marker(marker))
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

func endpointFromServiceError(err error, useSSL bool) string {
	serviceErr, ok := asServiceError(err)
	if !ok {
		return ""
	}
	return normalizeEndpoint(serviceErr.Endpoint, useSSL)
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
	return normalizeEndpoint(host, useSSL)
}

func normalizeEndpoint(endpoint string, useSSL bool) string {
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

func asServiceError(err error) (*oss.ServiceError, bool) {
	if err == nil {
		return nil, false
	}
	var ptr *oss.ServiceError
	if errors.As(err, &ptr) && ptr != nil {
		return ptr, true
	}
	var value oss.ServiceError
	if errors.As(err, &value) {
		return &value, true
	}
	return nil, false
}
