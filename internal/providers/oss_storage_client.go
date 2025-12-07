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

func (c *ossStorageClient) Security() SecurityDriver {
	return &UnimplementedSecurityDriver{}
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

func (d *ossBucketDriver) GetBucketACL(ctx context.Context, name string) (BucketACL, error) {
	var result BucketACL
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return result, errors.New("bucket name is required")
	}
	out, err := d.client.GetBucketACL(bucket, oss.WithContext(ctx))
	if err != nil {
		return result, wrapOSSError("获取 Bucket ACL", err)
	}
	result.OwnerID = out.Owner.ID
	result.OwnerDisplayName = out.Owner.DisplayName
	result.Canned = out.ACL
	return result, nil
}

func (d *ossBucketDriver) PutBucketACL(ctx context.Context, name string, acl BucketACLInput) error {
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return errors.New("bucket name is required")
	}
	canned := strings.TrimSpace(strings.ToLower(acl.Canned))
	if canned == "" {
		return fmt.Errorf("阿里云 OSS 仅支持设置预设 ACL")
	}
	var aclType oss.ACLType
	switch canned {
	case "private":
		aclType = oss.ACLPrivate
	case "public-read":
		aclType = oss.ACLPublicRead
	case "public-read-write":
		aclType = oss.ACLPublicReadWrite
	default:
		return fmt.Errorf("不支持的 ACL：%s", acl.Canned)
	}
	if err := d.client.SetBucketACL(bucket, aclType, oss.WithContext(ctx)); err != nil {
		return wrapOSSError("更新 Bucket ACL", err)
	}
	return nil
}

func (d *ossBucketDriver) GetPublicAccessBlock(ctx context.Context, name string) (PublicAccessBlock, error) {
	return PublicAccessBlock{}, ErrUnsupportedCapability
}

func (d *ossBucketDriver) PutPublicAccessBlock(ctx context.Context, name string, _ PublicAccessBlock) error {
	return ErrUnsupportedCapability
}

func (d *ossBucketDriver) GetBucketReferer(ctx context.Context, name string) (BucketReferer, error) {
	var result BucketReferer
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return result, errors.New("bucket name is required")
	}
	out, err := d.client.GetBucketReferer(bucket, oss.WithContext(ctx))
	if err != nil {
		return result, wrapOSSError("获取 Referer 配置", err)
	}
	result.AllowEmpty = out.AllowEmptyReferer
	if len(out.RefererList) > 0 {
		result.Whitelist = append([]string(nil), out.RefererList...)
	}
	result.Enabled = len(result.Whitelist) > 0
	result.Mode = "whitelist"
	return result, nil
}

func (d *ossBucketDriver) PutBucketReferer(ctx context.Context, name string, referer BucketReferer) error {
	bucket := strings.TrimSpace(name)
	if bucket == "" {
		return errors.New("bucket name is required")
	}
	cfg := oss.RefererXML{
		AllowEmptyReferer: referer.AllowEmpty,
	}
	if referer.Enabled {
		cfg.RefererList = append([]string(nil), referer.Whitelist...)
	} else {
		cfg.RefererList = []string{}
	}
	if err := d.client.SetBucketRefererV2(bucket, cfg, oss.WithContext(ctx)); err != nil {
		return wrapOSSError("更新 Referer 配置", err)
	}
	return nil
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
			StorageClass: "",
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

func (d *ossObjectDriver) DownloadObject(ctx context.Context, input DownloadObjectInput) (ObjectDownload, error) {
	var download ObjectDownload
	bucketName := strings.TrimSpace(input.Bucket)
	key := strings.TrimSpace(input.Key)
	if bucketName == "" {
		return download, errors.New("bucket is required")
	}
	if key == "" {
		return download, errors.New("object key is required")
	}
	bucket, err := d.bucket(ctx, bucketName)
	if err != nil {
		return download, err
	}
	opts := []oss.Option{oss.WithContext(ctx)}
	if input.VersionID != "" {
		opts = append(opts, oss.VersionId(input.VersionID))
	}
	if rng := buildHTTPRange(input.RangeStart, input.RangeEnd); rng != "" {
		opts = append(opts, oss.NormalizedRange(rng))
	}
	meta, _ := bucket.GetObjectDetailedMeta(key, opts...)
	body, err := bucket.GetObject(key, opts...)
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
		StorageClass: headerValue(meta, "x-oss-storage-class"),
		IsDir:        false,
		Metadata:     extractOSSMeta(meta),
		VersionID:    headerValue(meta, "x-oss-version-id"),
	}
	return info, nil
}

func extractOSSMeta(meta http.Header) map[string]string {
	result := make(map[string]string)
	for key, values := range meta {
		lower := strings.ToLower(key)
		if strings.HasPrefix(lower, "x-oss-meta-") && len(values) > 0 {
			result[strings.TrimPrefix(lower, "x-oss-meta-")] = values[0]
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func (d *ossObjectDriver) PresignURL(ctx context.Context, input PresignRequest) (string, error) {
	bucket := strings.TrimSpace(input.Bucket)
	key := strings.TrimSpace(input.Key)
	if bucket == "" {
		return "", errors.New("bucket is required")
	}
	if key == "" {
		return "", errors.New("object key is required")
	}
	b, err := d.bucket(ctx, bucket)
	if err != nil {
		return "", err
	}
	expiration := input.Expiration
	if expiration <= 0 {
		expiration = time.Hour
	}
	if expiration > 7*24*time.Hour {
		expiration = 7 * 24 * time.Hour
	}
	method := strings.ToUpper(strings.TrimSpace(input.Method))
	if method == "" {
		method = http.MethodGet
	}
	opts := []oss.Option{oss.WithContext(ctx)}
	if input.VersionID != "" {
		opts = append(opts, oss.VersionId(input.VersionID))
	}
	for header, value := range input.ResponseHeaders {
		switch strings.ToLower(strings.TrimSpace(header)) {
		case "content-type":
			opts = append(opts, oss.ResponseContentType(value))
		case "content-disposition":
			opts = append(opts, oss.ResponseContentDisposition(value))
		case "cache-control":
			opts = append(opts, oss.ResponseCacheControl(value))
		case "content-language":
			opts = append(opts, oss.ResponseContentLanguage(value))
		case "content-encoding":
			opts = append(opts, oss.ResponseContentEncoding(value))
		}
	}
	url, err := b.SignURL(key, oss.HTTPMethod(method), int64(expiration/time.Second), opts...)
	if err != nil {
		return "", wrapOSSError("生成预签名链接", err)
	}
	return url, nil
}

func (d *ossObjectDriver) InitiateMultipartUpload(ctx context.Context, bucket, key string) (string, error) {
	if strings.TrimSpace(key) == "" {
		return "", errors.New("object key is required")
	}
	b, err := d.bucket(ctx, bucket)
	if err != nil {
		return "", err
	}
	result, err := b.InitiateMultipartUpload(key)
	if err != nil {
		return "", wrapOSSError("初始化分片上传", err)
	}
	return result.UploadID, nil
}

func (d *ossObjectDriver) UploadPart(ctx context.Context, bucket, key, uploadID string, partNumber int, body io.Reader, size int64) (string, error) {
	if strings.TrimSpace(key) == "" {
		return "", errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return "", errors.New("upload id is required")
	}
	if partNumber <= 0 {
		return "", errors.New("part number must be greater than zero")
	}
	b, err := d.bucket(ctx, bucket)
	if err != nil {
		return "", err
	}
	imur := oss.InitiateMultipartUploadResult{
		Bucket:   bucket,
		Key:      key,
		UploadID: uploadID,
	}
	part, err := b.UploadPart(imur, body, size, partNumber)
	if err != nil {
		return "", wrapOSSError("上传分片", err)
	}
	return strings.Trim(part.ETag, `"`), nil
}

func (d *ossObjectDriver) CompleteMultipartUpload(ctx context.Context, bucket, key, uploadID string, parts map[int]string) error {
	if len(parts) == 0 {
		return errors.New("at least one part is required")
	}
	b, err := d.bucket(ctx, bucket)
	if err != nil {
		return err
	}
	imur := oss.InitiateMultipartUploadResult{
		Bucket:   bucket,
		Key:      key,
		UploadID: uploadID,
	}
	index := make([]int, 0, len(parts))
	for num := range parts {
		index = append(index, num)
	}
	sort.Ints(index)
	uploaded := make([]oss.UploadPart, 0, len(parts))
	for _, num := range index {
		uploaded = append(uploaded, oss.UploadPart{
			PartNumber: num,
			ETag:       parts[num],
		})
	}
	_, err = b.CompleteMultipartUpload(imur, uploaded)
	if err != nil {
		return wrapOSSError("完成分片上传", err)
	}
	return nil
}

func (d *ossObjectDriver) AbortMultipartUpload(ctx context.Context, bucket, key, uploadID string) error {
	b, err := d.bucket(ctx, bucket)
	if err != nil {
		return err
	}
	imur := oss.InitiateMultipartUploadResult{
		Bucket:   bucket,
		Key:      key,
		UploadID: uploadID,
	}
	if err := b.AbortMultipartUpload(imur); err != nil {
		return wrapOSSError("取消分片上传", err)
	}
	return nil
}

func (d *ossObjectDriver) GetObjectTags(ctx context.Context, bucketName, key string) (map[string]string, error) {
	return nil, ErrUnsupportedCapability
}

func (d *ossObjectDriver) PutObjectTags(ctx context.Context, bucketName, key string, tags map[string]string) error {
	return ErrUnsupportedCapability
}

func (d *ossObjectDriver) UpdateObjectMetadata(ctx context.Context, bucketName, key string, input ObjectMetadataUpdate) error {
	return ErrUnsupportedCapability
}

func (d *ossObjectDriver) GetObjectACL(ctx context.Context, bucketName, key string) (ObjectACL, error) {
	return ObjectACL{}, ErrUnsupportedCapability
}

func (d *ossObjectDriver) PutObjectACL(ctx context.Context, bucketName, key, cannedACL string) error {
	return ErrUnsupportedCapability
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
