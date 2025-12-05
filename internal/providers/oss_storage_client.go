package providers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"

	"can/internal/types"
)

type ossStorageClient struct {
	provider types.Provider
	client   *oss.Client
	creds    ConnectionCredentials
}

func newOSSStorageClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
	endpoint, hasEndpoint, err := normalizeEndpoint(creds)
	if err != nil {
		return nil, fmt.Errorf("解析 OSS Endpoint 失败: %w", err)
	}
	if !hasEndpoint {
		return nil, errors.New("OSS 需要显式设置 Endpoint")
	}
	opts := []oss.ClientOption{
		oss.Timeout(10, 60),
	}
	client, err := oss.New(endpoint, creds.AccessKeyID, creds.SecretAccessKey, opts...)
	if err != nil {
		return nil, fmt.Errorf("初始化 OSS 客户端失败: %w", err)
	}
	if region := strings.TrimSpace(creds.Region); region != "" {
		client.SetRegion(region)
	}
	return &ossStorageClient{
		provider: creds.Provider,
		client:   client,
		creds:    creds,
	}, nil
}

func (c *ossStorageClient) Provider() types.Provider {
	return c.provider
}

func (c *ossStorageClient) Capabilities() []types.ProviderCapability {
	return types.ProviderCapabilities(c.provider)
}

func (c *ossStorageClient) Buckets() BucketDriver {
	return &ossBucketDriver{client: c.client}
}

func (c *ossStorageClient) Objects() ObjectDriver {
	return &ossObjectDriver{client: c.client}
}

type ossBucketDriver struct {
	client *oss.Client
}

func (d *ossBucketDriver) ListBuckets(ctx context.Context) ([]BucketDescriptor, error) {
	result, err := d.client.ListBuckets(oss.WithContext(ctx))
	if err != nil {
		return nil, wrapOSSError("获取 Bucket 列表", err)
	}
	items := make([]BucketDescriptor, 0, len(result.Buckets))
	for _, bucket := range result.Buckets {
		items = append(items, BucketDescriptor{
			Name:        bucket.Name,
			Region:      bucket.Location,
			CreatedAt:   bucket.CreationDate,
			ObjectCount: -1,
			Size:        -1,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})
	return items, nil
}

func (d *ossBucketDriver) CreateBucket(ctx context.Context, name, _ string) error {
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return errors.New("bucket name is required")
	}
	if err := d.client.CreateBucket(bucket, oss.WithContext(ctx)); err != nil {
		return wrapOSSError("创建存储桶", err)
	}
	return nil
}

func (d *ossBucketDriver) DeleteBucket(ctx context.Context, name string) error {
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return errors.New("bucket name is required")
	}
	if err := d.client.DeleteBucket(bucket, oss.WithContext(ctx)); err != nil {
		return wrapOSSError("删除存储桶", err)
	}
	return nil
}

func (d *ossBucketDriver) HeadBucket(ctx context.Context, name string) error {
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return errors.New("bucket name is required")
	}
	exists, err := d.client.IsBucketExist(bucket)
	if err != nil {
		return wrapOSSError("检查存储桶", err)
	}
	if !exists {
		return fmt.Errorf("检查存储桶: %s 不存在", bucket)
	}
	return nil
}

func (d *ossBucketDriver) BucketLocation(ctx context.Context, name string) (string, error) {
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return "", errors.New("bucket name is required")
	}
	loc, err := d.client.GetBucketLocation(bucket, oss.WithContext(ctx))
	if err != nil {
		return "", wrapOSSError("获取存储桶区域", err)
	}
	return loc, nil
}

type ossObjectDriver struct {
	client *oss.Client
}

func (d *ossObjectDriver) bucket(ctx context.Context, name string) (*oss.Bucket, error) {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return nil, errors.New("bucket is required")
	}
	bucket, err := d.client.Bucket(bucketName)
	if err != nil {
		return nil, wrapOSSError("获取 Bucket 句柄", err)
	}
	return bucket, nil
}

func (d *ossObjectDriver) ListObjects(ctx context.Context, input ListObjectsInput) (ListObjectsResult, error) {
	var result ListObjectsResult
	bucket, err := d.bucket(ctx, input.Bucket)
	if err != nil {
		return result, err
	}
	options := []oss.Option{
		oss.WithContext(ctx),
	}
	if prefix := strings.TrimSpace(input.Prefix); prefix != "" {
		options = append(options, oss.Prefix(prefix))
	}
	delimiter := strings.TrimSpace(input.Delimiter)
	if delimiter == "" {
		delimiter = "/"
	}
	options = append(options, oss.Delimiter(delimiter))
	limit := input.Limit
	if limit <= 0 {
		limit = 1000
	}
	if limit > 1000 {
		limit = 1000
	}
	options = append(options, oss.MaxKeys(limit))
	if marker := strings.TrimSpace(input.Marker); marker != "" {
		options = append(options, oss.ContinuationToken(marker))
	}
	out, err := bucket.ListObjectsV2(options...)
	if err != nil {
		return result, wrapOSSError("列出对象", err)
	}
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
			ContentType:  "",
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

func (d *ossObjectDriver) UploadObject(ctx context.Context, bucketName, key string, body io.Reader, size int64, contentType string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	bucket, err := d.bucket(ctx, bucketName)
	if err != nil {
		return err
	}
	options := []oss.Option{oss.WithContext(ctx)}
	if size >= 0 {
		options = append(options, oss.ContentLength(size))
	}
	if contentType != "" {
		options = append(options, oss.ContentType(contentType))
	}
	if err := bucket.PutObject(key, body, options...); err != nil {
		return wrapOSSError("上传对象", err)
	}
	return nil
}

func (d *ossObjectDriver) DownloadObject(ctx context.Context, bucketName, key string) (ObjectDownload, error) {
	var download ObjectDownload
	if strings.TrimSpace(key) == "" {
		return download, errors.New("object key is required")
	}
	bucket, err := d.bucket(ctx, bucketName)
	if err != nil {
		return download, err
	}
	meta, _ := bucket.GetObjectDetailedMeta(key, oss.WithContext(ctx))
	body, err := bucket.GetObject(key, oss.WithContext(ctx))
	if err != nil {
		return download, wrapOSSError("下载对象", err)
	}
	download = ObjectDownload{
		Body:          body,
		ContentType:   headerValue(meta, "Content-Type"),
		ContentLength: parseInt64(headerValue(meta, "Content-Length")),
		ETag:          strings.Trim(headerValue(meta, "ETag"), `"`),
	}
	return download, nil
}

func (d *ossObjectDriver) DeleteObject(ctx context.Context, bucketName, key string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	bucket, err := d.bucket(ctx, bucketName)
	if err != nil {
		return err
	}
	if err := bucket.DeleteObject(key, oss.WithContext(ctx)); err != nil {
		return wrapOSSError("删除对象", err)
	}
	return nil
}

func (d *ossObjectDriver) CopyObject(ctx context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	if strings.TrimSpace(sourceKey) == "" || strings.TrimSpace(targetKey) == "" {
		return errors.New("source/target key is required")
	}
	src, err := d.bucket(ctx, sourceBucket)
	if err != nil {
		return err
	}
	if sourceBucket == targetBucket {
		if _, err := src.CopyObject(sourceKey, targetKey, oss.WithContext(ctx)); err != nil {
			return wrapOSSError("复制对象", err)
		}
		return nil
	}
	if _, err := src.CopyObjectTo(targetBucket, targetKey, sourceKey, oss.WithContext(ctx)); err != nil {
		return wrapOSSError("复制对象", err)
	}
	return nil
}

func (d *ossObjectDriver) HeadObject(ctx context.Context, bucketName, key string) (ObjectDescriptor, error) {
	var info ObjectDescriptor
	if strings.TrimSpace(key) == "" {
		return info, errors.New("object key is required")
	}
	bucket, err := d.bucket(ctx, bucketName)
	if err != nil {
		return info, err
	}
	meta, err := bucket.GetObjectDetailedMeta(key, oss.WithContext(ctx))
	if err != nil {
		return info, wrapOSSError("获取对象信息", err)
	}
	info = ObjectDescriptor{
		Key:          key,
		Size:         parseInt64(headerValue(meta, "Content-Length")),
		LastModified: parseTime(headerValue(meta, "Last-Modified")),
		ETag:         strings.Trim(headerValue(meta, "ETag"), `"`),
		ContentType:  headerValue(meta, "Content-Type"),
		IsDir:        false,
	}
	return info, nil
}

func headerValue(header http.Header, key string) string {
	if header == nil {
		return ""
	}
	return header.Get(key)
}

func parseInt64(value string) int64 {
	if value == "" {
		return 0
	}
	if v, err := strconv.ParseInt(value, 10, 64); err == nil {
		return v
	}
	return 0
}

func parseTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	if t, err := http.ParseTime(value); err == nil {
		return t
	}
	return time.Time{}
}

func wrapOSSError(action string, err error) error {
	if err == nil {
		return nil
	}
	var svcErr oss.ServiceError
	if errors.As(err, &svcErr) {
		message := svcErr.Message
		if message == "" {
			message = svcErr.Code
		}
		return fmt.Errorf("%s: %s (%s)", action, message, svcErr.Code)
	}
	return fmt.Errorf("%s: %w", action, err)
}
