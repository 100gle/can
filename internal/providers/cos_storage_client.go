package providers

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	cos "github.com/tencentyun/cos-go-sdk-v5"

	"can/internal/types"
)

type cosStorageClient struct {
	provider   types.Provider
	httpClient *http.Client
	serviceURL *url.URL
	region     string
}

func newCOSStorageClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
	serviceURL, err := resolveCOSServiceURL(creds)
	if err != nil {
		return nil, err
	}
	baseTransport := &http.Transport{
		Proxy:               http.ProxyFromEnvironment,
		DialContext:         (&net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		MaxIdleConnsPerHost: 10,
	}
	httpClient := &http.Client{
		Timeout: 60 * time.Second,
		Transport: &cos.AuthorizationTransport{
			SecretID:  strings.TrimSpace(creds.AccessKeyID),
			SecretKey: strings.TrimSpace(creds.SecretAccessKey),
			Transport: baseTransport,
		},
	}
	return &cosStorageClient{
		provider:   creds.Provider,
		httpClient: httpClient,
		serviceURL: serviceURL,
		region:     creds.Region,
	}, nil
}

func (c *cosStorageClient) Provider() types.Provider {
	return c.provider
}

func (c *cosStorageClient) Capabilities() []types.ProviderCapability {
	return types.ProviderCapabilities(c.provider)
}

func (c *cosStorageClient) Buckets() BucketDriver {
	return &cosBucketDriver{
		httpClient: c.httpClient,
		serviceURL: c.serviceURL,
	}
}

func (c *cosStorageClient) Objects() ObjectDriver {
	return &cosObjectDriver{
		httpClient: c.httpClient,
		serviceURL: c.serviceURL,
	}
}

func resolveCOSServiceURL(creds ConnectionCredentials) (*url.URL, error) {
	endpoint := strings.TrimSpace(creds.Endpoint)
	if endpoint == "" {
		if strings.TrimSpace(creds.Region) == "" {
			return nil, errors.New("COS 需要提供 Endpoint 或 Region")
		}
		endpoint = fmt.Sprintf("https://cos.%s.myqcloud.com", strings.TrimSpace(creds.Region))
	} else if !strings.Contains(endpoint, "://") {
		scheme := "https"
		if !creds.UseSSL {
			scheme = "http"
		}
		endpoint = fmt.Sprintf("%s://%s", scheme, endpoint)
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("解析 COS Endpoint 失败: %w", err)
	}
	return parsed, nil
}

type cosBucketDriver struct {
	httpClient *http.Client
	serviceURL *url.URL
}

func (d *cosBucketDriver) base() *cos.BaseURL {
	return &cos.BaseURL{ServiceURL: d.serviceURL}
}

func (d *cosBucketDriver) ListBuckets(ctx context.Context) ([]BucketDescriptor, error) {
	client := cos.NewClient(d.base(), d.httpClient)
	result, _, err := client.Service.Get(ctx)
	if err != nil {
		return nil, wrapCOSError("获取 Bucket 列表", err)
	}
	items := make([]BucketDescriptor, 0, len(result.Buckets))
	for _, bucket := range result.Buckets {
		createdAt := parseCOSTime(bucket.CreationDate)
		items = append(items, BucketDescriptor{
			Name:        bucket.Name,
			Region:      bucket.Region,
			CreatedAt:   createdAt,
			ObjectCount: -1,
			Size:        -1,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})
	return items, nil
}

func (d *cosBucketDriver) CreateBucket(ctx context.Context, name, _ string) error {
	client, err := d.forBucket(name)
	if err != nil {
		return err
	}
	if _, err := client.Bucket.Put(ctx, nil); err != nil {
		return wrapCOSError("创建存储桶", err)
	}
	return nil
}

func (d *cosBucketDriver) DeleteBucket(ctx context.Context, name string) error {
	client, err := d.forBucket(name)
	if err != nil {
		return err
	}
	if _, err := client.Bucket.Delete(ctx); err != nil {
		return wrapCOSError("删除存储桶", err)
	}
	return nil
}

func (d *cosBucketDriver) HeadBucket(ctx context.Context, name string) error {
	client, err := d.forBucket(name)
	if err != nil {
		return err
	}
	if _, err := client.Bucket.Head(ctx); err != nil {
		return wrapCOSError("检查存储桶", err)
	}
	return nil
}

func (d *cosBucketDriver) BucketLocation(ctx context.Context, name string) (string, error) {
	client, err := d.forBucket(name)
	if err != nil {
		return "", err
	}
	result, _, err := client.Bucket.GetLocation(ctx)
	if err != nil {
		return "", wrapCOSError("获取存储桶区域", err)
	}
	return result.Location, nil
}

func (d *cosBucketDriver) forBucket(name string) (*cos.Client, error) {
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("bucket name is required")
	}
	bucketURL, err := buildCOSBucketURL(name, d.serviceURL)
	if err != nil {
		return nil, err
	}
	base := &cos.BaseURL{
		ServiceURL: d.serviceURL,
		BucketURL:  bucketURL,
	}
	return cos.NewClient(base, d.httpClient), nil
}

type cosObjectDriver struct {
	httpClient *http.Client
	serviceURL *url.URL
}

func (d *cosObjectDriver) clientFor(bucket string) (*cos.Client, error) {
	if strings.TrimSpace(bucket) == "" {
		return nil, errors.New("bucket is required")
	}
	bucketURL, err := buildCOSBucketURL(bucket, d.serviceURL)
	if err != nil {
		return nil, err
	}
	base := &cos.BaseURL{
		ServiceURL: d.serviceURL,
		BucketURL:  bucketURL,
	}
	return cos.NewClient(base, d.httpClient), nil
}

func (d *cosObjectDriver) ListObjects(ctx context.Context, input ListObjectsInput) (ListObjectsResult, error) {
	var result ListObjectsResult
	client, err := d.clientFor(input.Bucket)
	if err != nil {
		return result, err
	}
	delimiter := strings.TrimSpace(input.Delimiter)
	if delimiter == "" {
		delimiter = "/"
	}
	limit := input.Limit
	if limit <= 0 {
		limit = 1000
	}
	if limit > 1000 {
		limit = 1000
	}
	opt := &cos.BucketGetOptions{
		Prefix:    strings.TrimSpace(input.Prefix),
		Delimiter: delimiter,
		Marker:    strings.TrimSpace(input.Marker),
		MaxKeys:   limit,
	}
	out, _, err := client.Bucket.Get(ctx, opt)
	if err != nil {
		return result, wrapCOSError("列出对象", err)
	}
	entries := make([]ObjectDescriptor, 0, len(out.CommonPrefixes)+len(out.Contents))
	for _, prefix := range out.CommonPrefixes {
		entries = append(entries, ObjectDescriptor{
			Key:   prefix,
			IsDir: true,
		})
	}
	for _, obj := range out.Contents {
		entries = append(entries, ObjectDescriptor{
			Key:          obj.Key,
			Size:         obj.Size,
			LastModified: parseCOSTime(obj.LastModified),
			ETag:         strings.Trim(obj.ETag, `"`),
			ContentType:  "",
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
	result.NextMarker = out.NextMarker
	return result, nil
}

func (d *cosObjectDriver) UploadObject(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return err
	}
	header := &cos.ObjectPutHeaderOptions{
		ContentType: contentType,
	}
	if size >= 0 {
		header.ContentLength = size
	}
	opt := &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: header,
	}
	if _, err := client.Object.Put(ctx, key, body, opt); err != nil {
		return wrapCOSError("上传对象", err)
	}
	return nil
}

func (d *cosObjectDriver) DownloadObject(ctx context.Context, bucket, key string) (ObjectDownload, error) {
	var download ObjectDownload
	if strings.TrimSpace(key) == "" {
		return download, errors.New("object key is required")
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return download, err
	}
	resp, err := client.Object.Get(ctx, key, nil)
	if err != nil {
		return download, wrapCOSError("下载对象", err)
	}
	download = ObjectDownload{
		Body:          resp.Body,
		ContentType:   resp.Header.Get("Content-Type"),
		ContentLength: resp.ContentLength,
		ETag:          strings.Trim(resp.Header.Get("Etag"), `"`),
	}
	return download, nil
}

func (d *cosObjectDriver) DeleteObject(ctx context.Context, bucket, key string) error {
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return err
	}
	if _, err := client.Object.Delete(ctx, key); err != nil {
		return wrapCOSError("删除对象", err)
	}
	return nil
}

func (d *cosObjectDriver) CopyObject(ctx context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	if strings.TrimSpace(sourceKey) == "" || strings.TrimSpace(targetKey) == "" {
		return errors.New("source/target key is required")
	}
	targetClient, err := d.clientFor(targetBucket)
	if err != nil {
		return err
	}
	sourceURL, err := buildCOSCopySource(sourceBucket, sourceKey, d.serviceURL)
	if err != nil {
		return err
	}
	if _, _, err := targetClient.Object.Copy(ctx, targetKey, sourceURL, nil); err != nil {
		return wrapCOSError("复制对象", err)
	}
	return nil
}

func (d *cosObjectDriver) HeadObject(ctx context.Context, bucket, key string) (ObjectDescriptor, error) {
	var info ObjectDescriptor
	if strings.TrimSpace(key) == "" {
		return info, errors.New("object key is required")
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return info, err
	}
	resp, err := client.Object.Head(ctx, key, nil)
	if err != nil {
		return info, wrapCOSError("获取对象信息", err)
	}
	info = ObjectDescriptor{
		Key:          key,
		Size:         resp.ContentLength,
		LastModified: parseCOSTime(resp.Header.Get("Last-Modified")),
		ETag:         strings.Trim(resp.Header.Get("Etag"), `"`),
		ContentType:  resp.Header.Get("Content-Type"),
		StorageClass: resp.Header.Get("x-cos-storage-class"),
		IsDir:        false,
	}
	return info, nil
}

func (d *cosObjectDriver) PresignURL(ctx context.Context, bucket, key string, expiration time.Duration, method string) (string, error) {
	client, err := d.clientFor(bucket)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(key) == "" {
		return "", errors.New("object key is required")
	}
	if expiration <= 0 {
		expiration = time.Hour
	}
	if expiration > 7*24*time.Hour {
		expiration = 7 * 24 * time.Hour
	}
	if strings.TrimSpace(method) == "" {
		method = http.MethodGet
	}
	u, err := client.Object.GetPresignedURL2(ctx, strings.ToUpper(method), key, expiration, nil)
	if err != nil {
		return "", wrapCOSError("生成预签名链接", err)
	}
	return u.String(), nil
}

func (d *cosObjectDriver) InitiateMultipartUpload(ctx context.Context, bucket, key string) (string, error) {
	if strings.TrimSpace(key) == "" {
		return "", errors.New("object key is required")
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return "", err
	}
	result, _, err := client.Object.InitiateMultipartUpload(ctx, key, nil)
	if err != nil {
		return "", wrapCOSError("初始化分片上传", err)
	}
	return result.UploadID, nil
}

func (d *cosObjectDriver) UploadPart(ctx context.Context, bucket, key, uploadID string, partNumber int, body io.Reader, size int64) (string, error) {
	if strings.TrimSpace(key) == "" {
		return "", errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return "", errors.New("upload id is required")
	}
	if partNumber <= 0 {
		return "", errors.New("part number must be greater than zero")
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return "", err
	}
	raw, err := io.ReadAll(body)
	if err != nil {
		return "", fmt.Errorf("读取分片数据失败: %w", err)
	}
	resp, err := client.Object.UploadPart(ctx, key, uploadID, partNumber, bytes.NewReader(raw), nil)
	if err != nil {
		return "", wrapCOSError("上传分片", err)
	}
	return strings.Trim(resp.Header.Get("Etag"), `"`), nil
}

func (d *cosObjectDriver) CompleteMultipartUpload(ctx context.Context, bucket, key, uploadID string, parts map[int]string) error {
	if len(parts) == 0 {
		return errors.New("at least one part is required")
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return err
	}
	index := make([]int, 0, len(parts))
	for part := range parts {
		index = append(index, part)
	}
	sort.Ints(index)
	opt := &cos.CompleteMultipartUploadOptions{}
	for _, part := range index {
		opt.Parts = append(opt.Parts, cos.Object{
			PartNumber: part,
			ETag:       parts[part],
		})
	}
	_, _, err = client.Object.CompleteMultipartUpload(ctx, key, uploadID, opt)
	if err != nil {
		return wrapCOSError("完成分片上传", err)
	}
	return nil
}

func (d *cosObjectDriver) AbortMultipartUpload(ctx context.Context, bucket, key, uploadID string) error {
	client, err := d.clientFor(bucket)
	if err != nil {
		return err
	}
	if _, err := client.Object.AbortMultipartUpload(ctx, key, uploadID); err != nil {
		return wrapCOSError("取消分片上传", err)
	}
	return nil
func (d *cosObjectDriver) GetObjectTags(ctx context.Context, bucket, key string) (map[string]string, error) {
	return nil, ErrUnsupportedCapability
}

func buildCOSBucketURL(bucket string, serviceURL *url.URL) (*url.URL, error) {
	if serviceURL == nil {
		return nil, errors.New("service endpoint 未配置")
	}
	if strings.TrimSpace(bucket) == "" {
		return nil, errors.New("bucket name is required")
	}
	clone := *serviceURL
	host := serviceURL.Host
	if strings.Contains(host, "{bucket}") {
		clone.Host = strings.ReplaceAll(host, "{bucket}", bucket)
	} else if strings.HasPrefix(host, "cos.") {
		clone.Host = fmt.Sprintf("%s.%s", bucket, host)
	} else if strings.Contains(host, ".cos.") {
		parts := strings.SplitN(host, ".cos.", 2)
		clone.Host = fmt.Sprintf("%s.cos.%s", bucket, parts[1])
	} else {
		clone.Host = fmt.Sprintf("%s.%s", bucket, host)
	}
	return &clone, nil
}

func buildCOSCopySource(bucket, key string, serviceURL *url.URL) (string, error) {
	bucketURL, err := buildCOSBucketURL(bucket, serviceURL)
	if err != nil {
		return "", err
	}
	key = strings.TrimLeft(key, "/")
	escapedKey := pathEscapePreserveSlash(key)
	return fmt.Sprintf("%s/%s", bucketURL.Host, escapedKey), nil
}

func pathEscapePreserveSlash(key string) string {
	segments := strings.Split(key, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}

func parseCOSTime(value string) time.Time {
	if value == "" {
		return time.Time{}
	}
	for _, layout := range []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05.000Z",
		"2006-01-02 15:04:05",
		http.TimeFormat,
	} {
		if t, err := time.Parse(layout, value); err == nil {
			return t
		}
	}
	return time.Time{}
}

func wrapCOSError(action string, err error) error {
	if err == nil {
		return nil
	}
	var apiErr *cos.ErrorResponse
	if errors.As(err, &apiErr) {
		message := apiErr.Message
		if message == "" {
			message = apiErr.Code
		}
		return fmt.Errorf("%s: %s (%s)", action, message, apiErr.Code)
	}
	var netErr net.Error
	if errors.As(err, &netErr) {
		if netErr.Timeout() {
			return fmt.Errorf("%s: 网络超时", action)
		}
		return fmt.Errorf("%s: 网络错误: %v", action, netErr)
	}
	return fmt.Errorf("%s: %w", action, err)
}
