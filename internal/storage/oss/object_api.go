package oss

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"sort"
	"strings"

	ossSDK "github.com/aliyun/aliyun-oss-go-sdk/oss"

	api "can/internal/storage/api"
)

// NewObjectAPI decorates the S3 object API with OSS-specific behavior.
func NewObjectAPI(base api.ObjectAPI, client *ossSDK.Client, creds api.ConnectionCredentials) api.ObjectAPI {
	return &objectAPI{
		ObjectAPI: base,
		client:    client,
		creds:     creds,
	}
}

type objectAPI struct {
	api.ObjectAPI
	client *ossSDK.Client
	creds  api.ConnectionCredentials
}

func (o *objectAPI) ListObjects(ctx context.Context, input api.ListObjectsInput) (api.ListObjectsResult, error) {
	var result api.ListObjectsResult
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
		logger.Warn("ListObjectsV2 failed, attempting endpoint recovery", "error", err)
		out, err = o.retryListObjectsWithAlternateEndpoint(ctx, bucketName, options, err, logger)
		if err != nil {
			logger.Error("ListObjectsV2 failed after retry", "error", err)
			return result, err
		}
	}
	logger.Debug("ListObjectsV2 succeeded", "objects", len(out.Objects), "prefixes", len(out.CommonPrefixes), "truncated", out.IsTruncated)

	entries := make([]api.ObjectDescriptor, 0, len(out.CommonPrefixes)+len(out.Objects))

	for _, prefix := range out.CommonPrefixes {
		entries = append(entries, api.ObjectDescriptor{
			Key:   prefix,
			IsDir: true,
		})
	}

	for _, obj := range out.Objects {
		entries = append(entries, api.ObjectDescriptor{
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

func (o *objectAPI) retryListObjectsWithAlternateEndpoint(
	ctx context.Context,
	bucketName string,
	options []ossSDK.Option,
	originalErr error,
	logger *slog.Logger,
) (ossSDK.ListObjectsResultV2, error) {
	var empty ossSDK.ListObjectsResultV2
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

	altClient, err := ossSDK.New(endpoint, o.creds.AccessKeyID, o.creds.SecretAccessKey)
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

func (o *objectAPI) resolveAlternateEndpoint(
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

func (o *objectAPI) lookupBucketLocation(ctx context.Context, bucketName string) (string, error) {
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

func (o *objectAPI) CreateSymlink(ctx context.Context, bucketName, key, target string) error {
	bucket, err := o.client.Bucket(bucketName)
	if err != nil {
		return err
	}
	return bucket.PutSymlink(key, target)
}

func (o *objectAPI) GetSymlink(ctx context.Context, bucketName, key string) (string, error) {
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

// delegate to base
func (o *objectAPI) UploadObject(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType string) error {
	return o.ObjectAPI.UploadObject(ctx, bucket, key, body, size, contentType)
}

func (o *objectAPI) DownloadObject(ctx context.Context, input api.DownloadObjectInput) (api.ObjectDownload, error) {
	return o.ObjectAPI.DownloadObject(ctx, input)
}

func (o *objectAPI) DeleteObject(ctx context.Context, bucket, key string) error {
	return o.ObjectAPI.DeleteObject(ctx, bucket, key)
}

func (o *objectAPI) DeleteObjects(ctx context.Context, bucket string, keys []string) (api.DeleteObjectsResult, error) {
	return o.ObjectAPI.DeleteObjects(ctx, bucket, keys)
}

func (o *objectAPI) CopyObject(ctx context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	return o.ObjectAPI.CopyObject(ctx, sourceBucket, sourceKey, targetBucket, targetKey)
}

func (o *objectAPI) HeadObject(ctx context.Context, bucket, key string) (api.ObjectDescriptor, error) {
	return o.ObjectAPI.HeadObject(ctx, bucket, key)
}

func (o *objectAPI) PresignURL(ctx context.Context, input api.PresignRequest) (string, error) {
	return o.ObjectAPI.PresignURL(ctx, input)
}

func (o *objectAPI) InitiateMultipartUpload(ctx context.Context, bucket, key string) (string, error) {
	return o.ObjectAPI.InitiateMultipartUpload(ctx, bucket, key)
}

func (o *objectAPI) UploadPart(ctx context.Context, bucket, key, uploadID string, partNumber int, body io.Reader, size int64) (string, error) {
	return o.ObjectAPI.UploadPart(ctx, bucket, key, uploadID, partNumber, body, size)
}

func (o *objectAPI) CompleteMultipartUpload(ctx context.Context, bucket, key, uploadID string, parts map[int]string) error {
	return o.ObjectAPI.CompleteMultipartUpload(ctx, bucket, key, uploadID, parts)
}

func (o *objectAPI) AbortMultipartUpload(ctx context.Context, bucket, key, uploadID string) error {
	return o.ObjectAPI.AbortMultipartUpload(ctx, bucket, key, uploadID)
}

func (o *objectAPI) GetObjectTags(ctx context.Context, bucket, key string) (map[string]string, error) {
	return o.ObjectAPI.GetObjectTags(ctx, bucket, key)
}

func (o *objectAPI) PutObjectTags(ctx context.Context, bucket, key string, tags map[string]string) error {
	return o.ObjectAPI.PutObjectTags(ctx, bucket, key, tags)
}

func (o *objectAPI) UpdateObjectMetadata(ctx context.Context, bucket, key string, input api.ObjectMetadataUpdate) error {
	return o.ObjectAPI.UpdateObjectMetadata(ctx, bucket, key, input)
}

func (o *objectAPI) GetObjectACL(ctx context.Context, bucket, key string) (api.ObjectACL, error) {
	return o.ObjectAPI.GetObjectACL(ctx, bucket, key)
}

func (o *objectAPI) PutObjectACL(ctx context.Context, bucket, key, cannedACL string) error {
	return o.ObjectAPI.PutObjectACL(ctx, bucket, key, cannedACL)
}

func (o *objectAPI) GetObjectLockConfiguration(ctx context.Context, bucket string) (api.ObjectLockConfiguration, error) {
	return o.ObjectAPI.GetObjectLockConfiguration(ctx, bucket)
}

func (o *objectAPI) GetObjectRetention(ctx context.Context, bucket, key, versionID string) (api.ObjectRetentionState, error) {
	return o.ObjectAPI.GetObjectRetention(ctx, bucket, key, versionID)
}

func (o *objectAPI) PutObjectRetention(ctx context.Context, input api.PutObjectRetentionInput) error {
	return o.ObjectAPI.PutObjectRetention(ctx, input)
}

func (o *objectAPI) GetObjectLegalHold(ctx context.Context, bucket, key, versionID string) (api.ObjectLegalHoldState, error) {
	return o.ObjectAPI.GetObjectLegalHold(ctx, bucket, key, versionID)
}

func (o *objectAPI) PutObjectLegalHold(ctx context.Context, input api.PutObjectLegalHoldInput) error {
	return o.ObjectAPI.PutObjectLegalHold(ctx, input)
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
