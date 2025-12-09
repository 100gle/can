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

func (c *cosStorageClient) Security() SecurityDriver {
	return &UnimplementedSecurityDriver{}
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

func (d *cosBucketDriver) CreateBucket(ctx context.Context, input BucketCreateInput) error {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return errors.New("bucket name is required")
	}
	client, err := d.forBucket(name)
	if err != nil {
		return err
	}
	var opt *cos.BucketPutOptions
	acl := strings.TrimSpace(input.ACL)
	if input.COSMultiAZ || acl != "" {
		opt = &cos.BucketPutOptions{}
	}
	if acl != "" {
		opt.XCosACL = acl
	}
	if input.COSMultiAZ {
		opt.CreateBucketConfiguration = &cos.CreateBucketConfiguration{
			BucketAZConfig: "MAZ",
		}
	}
	if _, err := client.Bucket.Put(ctx, opt); err != nil {
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

func (d *cosBucketDriver) GetBucketACL(ctx context.Context, name string) (BucketACL, error) {
	var result BucketACL
	client, err := d.forBucket(name)
	if err != nil {
		return result, err
	}
	out, resp, err := client.Bucket.GetACL(ctx)
	if err != nil {
		return result, wrapCOSError("获取 Bucket ACL", err)
	}
	if out.Owner != nil {
		result.OwnerID = out.Owner.ID
		result.OwnerDisplayName = out.Owner.DisplayName
	}
	result.Grants = convertCOSGrants(out.AccessControlList)
	if resp != nil && resp.Header != nil {
		result.Canned = resp.Header.Get("x-cos-acl")
	}
	if strings.TrimSpace(result.Canned) == "" {
		result.Canned = guessCOSCannedACL(result.Grants)
	}
	return result, nil
}

func (d *cosBucketDriver) PutBucketACL(ctx context.Context, name string, acl BucketACLInput) error {
	client, err := d.forBucket(name)
	if err != nil {
		return err
	}
	opt := &cos.BucketPutACLOptions{}
	if canned := strings.TrimSpace(acl.Canned); canned != "" {
		opt.Header = &cos.ACLHeaderOptions{
			XCosACL: canned,
		}
	} else {
		grants := convertToCOSGrants(acl.Grants)
		if len(grants) == 0 {
			return errors.New("请提供预设 ACL 或至少一个授权")
		}
		opt.Body = &cos.ACLXml{
			Owner:             &cos.Owner{ID: acl.OwnerID},
			AccessControlList: grants,
		}
	}
	if _, err := client.Bucket.PutACL(ctx, opt); err != nil {
		return wrapCOSError("更新 Bucket ACL", err)
	}
	return nil
}

func (d *cosBucketDriver) GetPublicAccessBlock(ctx context.Context, name string) (PublicAccessBlock, error) {
	return PublicAccessBlock{}, ErrUnsupportedCapability
}

func (d *cosBucketDriver) PutPublicAccessBlock(ctx context.Context, name string, _ PublicAccessBlock) error {
	return ErrUnsupportedCapability
}

func (d *cosBucketDriver) GetBucketReferer(ctx context.Context, name string) (BucketReferer, error) {
	var result BucketReferer
	client, err := d.forBucket(name)
	if err != nil {
		return result, err
	}
	out, _, err := client.Bucket.GetReferer(ctx)
	if err != nil {
		return result, wrapCOSError("获取 Referer 配置", err)
	}
	result.Mode = strings.ToLower(strings.TrimSpace(out.RefererType))
	result.Enabled = strings.EqualFold(strings.TrimSpace(out.Status), "enabled")
	if len(out.DomainList) > 0 {
		result.Whitelist = append([]string(nil), out.DomainList...)
	}
	result.AllowEmpty = !strings.EqualFold(out.EmptyReferConfiguration, "Deny")
	return result, nil
}

func (d *cosBucketDriver) PutBucketReferer(ctx context.Context, name string, referer BucketReferer) error {
	client, err := d.forBucket(name)
	if err != nil {
		return err
	}
	status := "Enabled"
	if !referer.Enabled {
		status = "Disabled"
	}
	mode := referer.Mode
	if strings.TrimSpace(mode) == "" {
		mode = "White-List"
	}
	opt := &cos.BucketPutRefererOptions{
		Status:                  status,
		RefererType:             mode,
		DomainList:              append([]string(nil), referer.Whitelist...),
		EmptyReferConfiguration: "Allow",
	}
	if !referer.AllowEmpty {
		opt.EmptyReferConfiguration = "Deny"
	}
	if !referer.Enabled {
		opt.DomainList = []string{}
	}
	if _, err := client.Bucket.PutReferer(ctx, opt); err != nil {
		return wrapCOSError("更新 Referer 配置", err)
	}
	return nil
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

func convertCOSGrants(grants []cos.ACLGrant) []AccessGrant {
	if len(grants) == 0 {
		return nil
	}
	out := make([]AccessGrant, 0, len(grants))
	for _, grant := range grants {
		if grant.Grantee == nil {
			continue
		}
		entry := AccessGrant{
			Permission: grant.Permission,
		}
		if strings.Contains(strings.ToLower(grant.Grantee.Type), "group") || strings.Contains(strings.ToLower(grant.Grantee.URI), "groups") {
			entry.GranteeType = "Group"
			entry.URI = grant.Grantee.URI
			entry.Grantee = grant.Grantee.URI
		} else {
			entry.GranteeType = "CanonicalUser"
			entry.Grantee = grant.Grantee.ID
			entry.DisplayName = grant.Grantee.DisplayName
		}
		out = append(out, entry)
	}
	return out
}

func convertToCOSGrants(grants []AccessGrant) []cos.ACLGrant {
	if len(grants) == 0 {
		return nil
	}
	out := make([]cos.ACLGrant, 0, len(grants))
	for _, grant := range grants {
		if strings.TrimSpace(grant.Permission) == "" {
			continue
		}
		grantee := &cos.ACLGrantee{}
		switch strings.ToLower(strings.TrimSpace(grant.GranteeType)) {
		case "group":
			grantee.Type = "Group"
			grantee.URI = strings.TrimSpace(grant.URI)
			if grantee.URI == "" {
				grantee.URI = strings.TrimSpace(grant.Grantee)
			}
			if grantee.URI == "" {
				continue
			}
		default:
			grantee.Type = "CanonicalUser"
			grantee.ID = strings.TrimSpace(grant.Grantee)
			if grantee.ID == "" {
				continue
			}
			grantee.DisplayName = strings.TrimSpace(grant.DisplayName)
		}
		out = append(out, cos.ACLGrant{
			Grantee:    grantee,
			Permission: grant.Permission,
		})
	}
	return out
}

func guessCOSCannedACL(grants []AccessGrant) string {
	if len(grants) == 0 {
		return ""
	}
	var hasPublicRead, hasPublicWrite bool
	for _, grant := range grants {
		if strings.EqualFold(grant.GranteeType, "Group") &&
			strings.Contains(strings.ToLower(grant.Grantee), "allusers") {
			switch strings.ToUpper(grant.Permission) {
			case "READ":
				hasPublicRead = true
			case "WRITE":
				hasPublicWrite = true
			case "FULL_CONTROL":
				return "public-read-write"
			}
		}
	}
	switch {
	case hasPublicRead && hasPublicWrite:
		return "public-read-write"
	case hasPublicRead:
		return "public-read"
	default:
		return "private"
	}
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
	// Delimiter controls hierarchy: empty = flat list (all objects), "/" = folder hierarchy
	delimiter := input.Delimiter
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

func (d *cosObjectDriver) DownloadObject(ctx context.Context, input DownloadObjectInput) (ObjectDownload, error) {
	var download ObjectDownload
	bucket := strings.TrimSpace(input.Bucket)
	key := strings.TrimSpace(input.Key)
	if bucket == "" {
		return download, errors.New("bucket is required")
	}
	if key == "" {
		return download, errors.New("object key is required")
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return download, err
	}
	options := &cos.ObjectGetOptions{}
	if rng := buildHTTPRange(input.RangeStart, input.RangeEnd); rng != "" {
		options.Range = rng
	}
	var versionArgs []string
	if input.VersionID != "" {
		versionArgs = append(versionArgs, input.VersionID)
	}
	resp, err := client.Object.Get(ctx, key, options, versionArgs...)
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

// DeleteObjects batch-deletes up to 1000 objects using the COS DeleteMultiple API.
func (d *cosObjectDriver) DeleteObjects(ctx context.Context, bucket string, keys []string) (DeleteObjectsResult, error) {
	var result DeleteObjectsResult
	if len(keys) == 0 {
		return result, nil
	}
	client, err := d.clientFor(bucket)
	if err != nil {
		return result, err
	}

	// COS DeleteMultiple supports up to 1000 keys per request
	const batchSize = 1000
	for i := 0; i < len(keys); i += batchSize {
		end := i + batchSize
		if end > len(keys) {
			end = len(keys)
		}
		batch := keys[i:end]

		objects := make([]cos.Object, 0, len(batch))
		for _, key := range batch {
			key = strings.TrimSpace(key)
			if key != "" {
				objects = append(objects, cos.Object{Key: key})
			}
		}
		if len(objects) == 0 {
			continue
		}

		opt := &cos.ObjectDeleteMultiOptions{
			Objects: objects,
			Quiet:   false,
		}
		out, _, err := client.Object.DeleteMulti(ctx, opt)
		if err != nil {
			// If the entire batch fails, record all keys as errors
			for _, key := range batch {
				result.Errors = append(result.Errors, DeleteObjectError{
					Key:     key,
					Code:    "BatchFailed",
					Message: err.Error(),
				})
			}
			continue
		}

		// Collect successful deletions
		for _, deleted := range out.DeletedObjects {
			result.Deleted = append(result.Deleted, deleted.Key)
		}

		// Collect errors
		for _, delErr := range out.Errors {
			result.Errors = append(result.Errors, DeleteObjectError{
				Key:     delErr.Key,
				Code:    delErr.Code,
				Message: delErr.Message,
			})
		}
	}

	return result, nil
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

func (d *cosObjectDriver) CreateSymlink(context.Context, string, string, string) error {
	return ErrUnsupportedCapability
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
		Metadata:     extractCOSMeta(resp.Header),
		VersionID:    resp.Header.Get("x-cos-version-id"),
	}
	return info, nil
}

func extractCOSMeta(header http.Header) map[string]string {
	result := make(map[string]string)
	for key, values := range header {
		lower := strings.ToLower(key)
		if strings.HasPrefix(lower, "x-cos-meta-") && len(values) > 0 {
			result[strings.TrimPrefix(lower, "x-cos-meta-")] = values[0]
		}
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func (d *cosObjectDriver) PresignURL(ctx context.Context, input PresignRequest) (string, error) {
	bucket := strings.TrimSpace(input.Bucket)
	key := strings.TrimSpace(input.Key)
	client, err := d.clientFor(bucket)
	if err != nil {
		return "", err
	}
	if key == "" {
		return "", errors.New("object key is required")
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
	options := &cos.PresignedURLOptions{}
	if q := responseHeaderQuery(input.ResponseHeaders); q != nil {
		options.Query = q
	}
	if input.VersionID != "" {
		if options.Query == nil {
			options.Query = &url.Values{}
		}
		options.Query.Set("versionId", input.VersionID)
	}
	u, err := client.Object.GetPresignedURL2(ctx, method, key, expiration, options)
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
}

func (d *cosObjectDriver) GetObjectTags(ctx context.Context, bucket, key string) (map[string]string, error) {
	return nil, ErrUnsupportedCapability
}

func (d *cosObjectDriver) PutObjectTags(ctx context.Context, bucket, key string, tags map[string]string) error {
	return ErrUnsupportedCapability
}

func (d *cosObjectDriver) UpdateObjectMetadata(ctx context.Context, bucket, key string, input ObjectMetadataUpdate) error {
	return ErrUnsupportedCapability
}

func (d *cosObjectDriver) GetObjectACL(ctx context.Context, bucket, key string) (ObjectACL, error) {
	return ObjectACL{}, ErrUnsupportedCapability
}

func (d *cosObjectDriver) PutObjectACL(ctx context.Context, bucket, key, cannedACL string) error {
	return ErrUnsupportedCapability
}

func (d *cosObjectDriver) GetObjectLockConfiguration(context.Context, string) (ObjectLockConfiguration, error) {
	return ObjectLockConfiguration{}, ErrUnsupportedCapability
}

func (d *cosObjectDriver) GetObjectRetention(context.Context, string, string, string) (ObjectRetentionState, error) {
	return ObjectRetentionState{}, ErrUnsupportedCapability
}

func (d *cosObjectDriver) PutObjectRetention(context.Context, PutObjectRetentionInput) error {
	return ErrUnsupportedCapability
}

func (d *cosObjectDriver) GetObjectLegalHold(context.Context, string, string, string) (ObjectLegalHoldState, error) {
	return ObjectLegalHoldState{}, ErrUnsupportedCapability
}

func (d *cosObjectDriver) PutObjectLegalHold(context.Context, PutObjectLegalHoldInput) error {
	return ErrUnsupportedCapability
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
