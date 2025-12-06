package providers

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"

	"can/internal/types"
)

type s3StorageClient struct {
	provider types.Provider
	client   S3Client
	creds    ConnectionCredentials
}

func newS3StorageClient(ctx context.Context, creds ConnectionCredentials, factory S3ClientFactory) (StorageClient, error) {
	client, err := factory.NewClient(ctx, creds)
	if err != nil {
		return nil, err
	}
	return &s3StorageClient{
		provider: creds.Provider,
		client:   client,
		creds:    creds,
	}, nil
}

func (c *s3StorageClient) Provider() types.Provider {
	return c.provider
}

func (c *s3StorageClient) Capabilities() []types.ProviderCapability {
	return types.ProviderCapabilities(c.provider)
}

func (c *s3StorageClient) Buckets() BucketDriver {
	return &s3BucketDriver{client: c.client, creds: c.creds}
}

func (c *s3StorageClient) Objects() ObjectDriver {
	return &s3ObjectDriver{client: c.client}
}

type s3BucketDriver struct {
	client S3Client
	creds  ConnectionCredentials
}

func (d *s3BucketDriver) ListBuckets(ctx context.Context) ([]BucketDescriptor, error) {
	out, err := d.client.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		return nil, WrapS3Error("获取 Bucket 列表", err)
	}
	items := make([]BucketDescriptor, 0, len(out.Buckets))
	for _, bucket := range out.Buckets {
		name := aws.ToString(bucket.Name)
		region := d.creds.Region
		if loc, locErr := d.lookupBucketRegion(ctx, name); locErr == nil && loc != "" {
			region = loc
		}
		items = append(items, BucketDescriptor{
			Name:        name,
			CreatedAt:   aws.ToTime(bucket.CreationDate),
			Region:      region,
			ObjectCount: -1,
			Size:        -1,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})
	return items, nil
}

func (d *s3BucketDriver) CreateBucket(ctx context.Context, name, region string) error {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	if region == "" {
		region = d.creds.Region
	}
	input := &s3.CreateBucketInput{Bucket: aws.String(bucketName)}
	if shouldIncludeLocationConstraint(d.creds.Provider, region) {
		input.CreateBucketConfiguration = &s3types.CreateBucketConfiguration{
			LocationConstraint: s3types.BucketLocationConstraint(region),
		}
	}
	if _, err := d.client.CreateBucket(ctx, input); err != nil {
		return WrapS3Error("创建存储桶", err)
	}
	return nil
}

func (d *s3BucketDriver) DeleteBucket(ctx context.Context, name string) error {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	if _, err := d.client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucketName)}); err != nil {
		return WrapS3Error("删除存储桶", err)
	}
	return nil
}

func (d *s3BucketDriver) HeadBucket(ctx context.Context, name string) error {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	if _, err := d.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucketName)}); err != nil {
		return WrapS3Error("检查存储桶", err)
	}
	return nil
}

func (d *s3BucketDriver) BucketLocation(ctx context.Context, name string) (string, error) {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return "", errors.New("bucket name is required")
	}
	region, err := d.lookupBucketRegion(ctx, bucketName)
	if err != nil {
		return "", WrapS3Error("获取存储桶区域", err)
	}
	return region, nil
}

func (d *s3BucketDriver) lookupBucketRegion(ctx context.Context, name string) (string, error) {
	out, err := d.client.GetBucketLocation(ctx, &s3.GetBucketLocationInput{Bucket: aws.String(name)})
	if err != nil {
		return "", err
	}
	if out == nil || out.LocationConstraint == "" {
		return "us-east-1", nil
	}
	return string(out.LocationConstraint), nil
}

type s3ObjectDriver struct {
	client S3Client
}

func (d *s3ObjectDriver) ListObjects(ctx context.Context, input ListObjectsInput) (ListObjectsResult, error) {
	var result ListObjectsResult
	bucket := strings.TrimSpace(input.Bucket)
	if bucket == "" {
		return result, errors.New("bucket is required")
	}
	params := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
	}
	if prefix := strings.TrimSpace(input.Prefix); prefix != "" {
		params.Prefix = aws.String(prefix)
	}
	delimiter := strings.TrimSpace(input.Delimiter)
	if delimiter == "" {
		delimiter = "/"
	}
	params.Delimiter = aws.String(delimiter)
	limit := int32(input.Limit)
	if limit <= 0 {
		limit = 1000
	}
	if limit > 1000 {
		limit = 1000
	}
	params.MaxKeys = aws.Int32(limit)
	if marker := strings.TrimSpace(input.Marker); marker != "" {
		params.ContinuationToken = aws.String(marker)
	}
	out, err := d.client.ListObjectsV2(ctx, params)
	if err != nil {
		return result, WrapS3Error("列出对象", err)
	}
	entries := make([]ObjectDescriptor, 0, len(out.CommonPrefixes)+len(out.Contents))
	for _, prefix := range out.CommonPrefixes {
		entries = append(entries, ObjectDescriptor{
			Key:   aws.ToString(prefix.Prefix),
			IsDir: true,
		})
	}
	for _, obj := range out.Contents {
		entries = append(entries, ObjectDescriptor{
			Key:          aws.ToString(obj.Key),
			Size:         aws.ToInt64(obj.Size),
			LastModified: aws.ToTime(obj.LastModified),
			ETag:         strings.Trim(aws.ToString(obj.ETag), `"`),
			ContentType:  "",
			StorageClass: string(obj.StorageClass),
			IsDir:        false,
			Metadata:     nil,
			VersionID:    "",
		})
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir != entries[j].IsDir {
			return entries[i].IsDir
		}
		return entries[i].Key < entries[j].Key
	})
	result.Objects = entries
	result.Truncated = aws.ToBool(out.IsTruncated)
	result.NextMarker = aws.ToString(out.NextContinuationToken)
	return result, nil
}

func (d *s3ObjectDriver) UploadObject(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType string) error {
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	input := &s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        body,
		ContentType: aws.String(contentType),
	}
	if size >= 0 {
		input.ContentLength = aws.Int64(size)
	}
	if _, err := d.client.PutObject(ctx, input); err != nil {
		return WrapS3Error("上传对象", err)
	}
	return nil
}

func (d *s3ObjectDriver) DownloadObject(ctx context.Context, input DownloadObjectInput) (ObjectDownload, error) {
	var download ObjectDownload
	bucket := strings.TrimSpace(input.Bucket)
	key := strings.TrimSpace(input.Key)
	if bucket == "" {
		return download, errors.New("bucket is required")
	}
	if key == "" {
		return download, errors.New("object key is required")
	}
	params := &s3.GetObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}
	if input.VersionID != "" {
		params.VersionId = aws.String(input.VersionID)
	}
	if rng := buildHTTPRange(input.RangeStart, input.RangeEnd); rng != "" {
		params.Range = aws.String(rng)
	}
	resp, err := d.client.GetObject(ctx, params)
	if err != nil {
		return download, WrapS3Error("下载对象", err)
	}
	download = ObjectDownload{
		Body:          resp.Body,
		ContentType:   aws.ToString(resp.ContentType),
		ContentLength: aws.ToInt64(resp.ContentLength),
		ETag:          strings.Trim(aws.ToString(resp.ETag), `"`),
	}
	return download, nil
}

func (d *s3ObjectDriver) DeleteObject(ctx context.Context, bucket, key string) error {
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	if _, err := d.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	}); err != nil {
		return WrapS3Error("删除对象", err)
	}
	return nil
}

func (d *s3ObjectDriver) CopyObject(ctx context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	if strings.TrimSpace(sourceBucket) == "" || strings.TrimSpace(sourceKey) == "" {
		return errors.New("source bucket/key is required")
	}
	if strings.TrimSpace(targetBucket) == "" || strings.TrimSpace(targetKey) == "" {
		return errors.New("target bucket/key is required")
	}
	copySource := fmt.Sprintf("%s/%s", sourceBucket, escapeCopyKey(sourceKey))
	if _, err := d.client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(targetBucket),
		Key:        aws.String(targetKey),
		CopySource: aws.String(copySource),
	}); err != nil {
		return WrapS3Error("复制对象", err)
	}
	return nil
}

func (d *s3ObjectDriver) HeadObject(ctx context.Context, bucket, key string) (ObjectDescriptor, error) {
	var info ObjectDescriptor
	if strings.TrimSpace(bucket) == "" {
		return info, errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return info, errors.New("object key is required")
	}
	out, err := d.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return info, WrapS3Error("获取对象信息", err)
	}
	info = ObjectDescriptor{
		Key:          key,
		Size:         aws.ToInt64(out.ContentLength),
		LastModified: aws.ToTime(out.LastModified),
		ETag:         strings.Trim(aws.ToString(out.ETag), `"`),
		ContentType:  aws.ToString(out.ContentType),
		StorageClass: string(out.StorageClass),
		IsDir:        false,
		Metadata:     cloneMetadata(out.Metadata),
		VersionID:    aws.ToString(out.VersionId),
	}
	return info, nil
}

func cloneMetadata(src map[string]string) map[string]string {
	if len(src) == 0 {
		return nil
	}
	dst := make(map[string]string, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

func applyS3ResponseHeaders(input *s3.GetObjectInput, headers map[string]string) {
	if input == nil || len(headers) == 0 {
		return
	}
	for key, value := range headers {
		lower := strings.ToLower(strings.TrimSpace(key))
		if value == "" {
			continue
		}
		switch lower {
		case "content-type":
			input.ResponseContentType = aws.String(value)
		case "content-disposition":
			input.ResponseContentDisposition = aws.String(value)
		case "cache-control":
			input.ResponseCacheControl = aws.String(value)
		case "content-language":
			input.ResponseContentLanguage = aws.String(value)
		case "content-encoding":
			input.ResponseContentEncoding = aws.String(value)
		}
	}
}

func (d *s3ObjectDriver) PresignURL(ctx context.Context, input PresignRequest) (string, error) {
	bucket := strings.TrimSpace(input.Bucket)
	key := strings.TrimSpace(input.Key)
	if bucket == "" {
		return "", errors.New("bucket is required")
	}
	if key == "" {
		return "", errors.New("object key is required")
	}
	raw, ok := d.client.(*s3.Client)
	if !ok {
		return "", errors.New("presign not supported for this client")
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
	presign := s3.NewPresignClient(raw)
	switch method {
	case http.MethodGet:
		params := &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		}
		if input.VersionID != "" {
			params.VersionId = aws.String(input.VersionID)
		}
		applyS3ResponseHeaders(params, input.ResponseHeaders)
		out, err := presign.PresignGetObject(ctx, params, func(opts *s3.PresignOptions) {
			opts.Expires = expiration
		})
		if err != nil {
			return "", WrapS3Error("生成下载链接", err)
		}
		return out.URL, nil
	case http.MethodPut:
		params := &s3.PutObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		}
		out, err := presign.PresignPutObject(ctx, params, func(opts *s3.PresignOptions) {
			opts.Expires = expiration
		})
		if err != nil {
			return "", WrapS3Error("生成上传链接", err)
		}
		return out.URL, nil
	case http.MethodHead:
		params := &s3.HeadObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		}
		if input.VersionID != "" {
			params.VersionId = aws.String(input.VersionID)
		}
		out, err := presign.PresignHeadObject(ctx, params, func(opts *s3.PresignOptions) {
			opts.Expires = expiration
		})
		if err != nil {
			return "", WrapS3Error("生成校验链接", err)
		}
		return out.URL, nil
	case http.MethodDelete:
		params := &s3.DeleteObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		}
		out, err := presign.PresignDeleteObject(ctx, params, func(opts *s3.PresignOptions) {
			opts.Expires = expiration
		})
		if err != nil {
			return "", WrapS3Error("生成删除链接", err)
		}
		return out.URL, nil
	default:
		return "", fmt.Errorf("unsupported method %s", method)
	}
}

func (d *s3ObjectDriver) InitiateMultipartUpload(ctx context.Context, bucket, key string) (string, error) {
	if strings.TrimSpace(bucket) == "" {
		return "", errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return "", errors.New("object key is required")
	}
	out, err := d.client.CreateMultipartUpload(ctx, &s3.CreateMultipartUploadInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return "", WrapS3Error("初始化分片上传", err)
	}
	return aws.ToString(out.UploadId), nil
}

func (d *s3ObjectDriver) GetObjectTags(ctx context.Context, bucket, key string) (map[string]string, error) {
	if strings.TrimSpace(bucket) == "" {
		return nil, errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return nil, errors.New("object key is required")
	}
	out, err := d.client.GetObjectTagging(ctx, &s3.GetObjectTaggingInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, WrapS3Error("获取对象标签", err)
	}
	result := make(map[string]string, len(out.TagSet))
	for _, tag := range out.TagSet {
		result[aws.ToString(tag.Key)] = aws.ToString(tag.Value)
	}
	return result, nil
}

func (d *s3ObjectDriver) PutObjectTags(ctx context.Context, bucket, key string, tags map[string]string) error {
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	tagging := &s3types.Tagging{}
	if len(tags) > 0 {
		tagging.TagSet = make([]s3types.Tag, 0, len(tags))
		for k, v := range tags {
			tagging.TagSet = append(tagging.TagSet, s3types.Tag{
				Key:   aws.String(k),
				Value: aws.String(v),
			})
		}
	}
	if _, err := d.client.PutObjectTagging(ctx, &s3.PutObjectTaggingInput{
		Bucket:  aws.String(bucket),
		Key:     aws.String(key),
		Tagging: tagging,
	}); err != nil {
		return WrapS3Error("更新对象标签", err)
	}
	return nil
}

func (d *s3ObjectDriver) UploadPart(ctx context.Context, bucket, key, uploadID string, partNumber int, body io.Reader, size int64) (string, error) {
	if strings.TrimSpace(bucket) == "" {
		return "", errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return "", errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return "", errors.New("upload id is required")
	}
	if partNumber <= 0 {
		return "", errors.New("part number must be greater than zero")
	}
	input := &s3.UploadPartInput{
		Bucket:     aws.String(bucket),
		Key:        aws.String(key),
		UploadId:   aws.String(uploadID),
		PartNumber: aws.Int32(int32(partNumber)),
		Body:       body,
	}
	if size >= 0 {
		input.ContentLength = aws.Int64(size)
	}
	out, err := d.client.UploadPart(ctx, input)
	if err != nil {
		return "", WrapS3Error("上传分片", err)
	}
	return strings.Trim(aws.ToString(out.ETag), `"`), nil
}

func (d *s3ObjectDriver) CompleteMultipartUpload(ctx context.Context, bucket, key, uploadID string, parts map[int]string) error {
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return errors.New("upload id is required")
	}
	if len(parts) == 0 {
		return errors.New("at least one part is required")
	}
	indexes := make([]int, 0, len(parts))
	for part := range parts {
		indexes = append(indexes, part)
	}
	sort.Ints(indexes)
	completed := make([]s3types.CompletedPart, 0, len(parts))
	for _, part := range indexes {
		etag := strings.Trim(parts[part], `"`)
		completed = append(completed, s3types.CompletedPart{
			ETag:       aws.String(etag),
			PartNumber: aws.Int32(int32(part)),
		})
	}
	_, err := d.client.CompleteMultipartUpload(ctx, &s3.CompleteMultipartUploadInput{
		Bucket:   aws.String(bucket),
		Key:      aws.String(key),
		UploadId: aws.String(uploadID),
		MultipartUpload: &s3types.CompletedMultipartUpload{
			Parts: completed,
		},
	})
	if err != nil {
		return WrapS3Error("完成分片上传", err)
	}
	return nil
}

func (d *s3ObjectDriver) AbortMultipartUpload(ctx context.Context, bucket, key, uploadID string) error {
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return errors.New("upload id is required")
	}
	if _, err := d.client.AbortMultipartUpload(ctx, &s3.AbortMultipartUploadInput{
		Bucket:   aws.String(bucket),
		Key:      aws.String(key),
		UploadId: aws.String(uploadID),
	}); err != nil {
		return WrapS3Error("取消分片上传", err)
	}
	return nil
}

func (d *s3ObjectDriver) UpdateObjectMetadata(ctx context.Context, bucket, key string, input ObjectMetadataUpdate) error {
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	copySource := fmt.Sprintf("%s/%s", bucket, escapeCopyKey(key))
	params := &s3.CopyObjectInput{
		Bucket:     aws.String(bucket),
		Key:        aws.String(key),
		CopySource: aws.String(copySource),
	}
	changeMetadata := input.Metadata != nil || input.ContentType != ""
	if input.Metadata != nil {
		params.MetadataDirective = s3types.MetadataDirectiveReplace
		params.Metadata = make(map[string]string, len(input.Metadata))
		for k, v := range input.Metadata {
			params.Metadata[k] = v
		}
	}
	if input.ContentType != "" {
		params.MetadataDirective = s3types.MetadataDirectiveReplace
		params.ContentType = aws.String(input.ContentType)
	}
	if params.MetadataDirective == "" {
		params.MetadataDirective = s3types.MetadataDirectiveCopy
	}
	if input.StorageClass != "" {
		params.StorageClass = s3types.StorageClass(input.StorageClass)
	}
	if !changeMetadata && input.StorageClass == "" {
		// Nothing to do.
		return nil
	}
	if _, err := d.client.CopyObject(ctx, params); err != nil {
		return WrapS3Error("更新对象元数据", err)
	}
	return nil
}

func (d *s3ObjectDriver) GetObjectACL(ctx context.Context, bucket, key string) (ObjectACL, error) {
	var acl ObjectACL
	if strings.TrimSpace(bucket) == "" {
		return acl, errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return acl, errors.New("object key is required")
	}
	out, err := d.client.GetObjectAcl(ctx, &s3.GetObjectAclInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return acl, WrapS3Error("获取对象 ACL", err)
	}
	grants := make([]AccessGrant, 0, len(out.Grants))
	for _, grant := range out.Grants {
		grants = append(grants, AccessGrant{
			GranteeType: string(grant.Grantee.Type),
			Grantee:     describeS3Grantee(grant.Grantee),
			Permission:  string(grant.Permission),
		})
	}
	acl = ObjectACL{
		Canned:           detectS3CannedACL(out.Grants),
		OwnerID:          aws.ToString(out.Owner.ID),
		OwnerDisplayName: aws.ToString(out.Owner.DisplayName),
		Grants:           grants,
	}
	return acl, nil
}

func (d *s3ObjectDriver) PutObjectACL(ctx context.Context, bucket, key, cannedACL string) error {
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	cannedACL = strings.TrimSpace(cannedACL)
	if cannedACL == "" {
		return errors.New("acl is required")
	}
	input := &s3.PutObjectAclInput{
		Bucket: aws.String(bucket),
		Key:    aws.String(key),
		ACL:    s3types.ObjectCannedACL(cannedACL),
	}
	if _, err := d.client.PutObjectAcl(ctx, input); err != nil {
		return WrapS3Error("更新对象 ACL", err)
	}
	return nil
}

func shouldIncludeLocationConstraint(provider types.Provider, region string) bool {
	if region == "" {
		return false
	}
	if provider == types.ProviderAWS && strings.EqualFold(region, "us-east-1") {
		return false
	}
	return true
}

func escapeCopyKey(key string) string {
	if key == "" {
		return ""
	}
	segments := strings.Split(key, "/")
	for i, segment := range segments {
		segments[i] = url.PathEscape(segment)
	}
	return strings.Join(segments, "/")
}

func describeS3Grantee(grantee *s3types.Grantee) string {
	if grantee == nil {
		return ""
	}
	if grantee.URI != nil {
		return aws.ToString(grantee.URI)
	}
	if grantee.ID != nil {
		return aws.ToString(grantee.ID)
	}
	if grantee.EmailAddress != nil {
		return aws.ToString(grantee.EmailAddress)
	}
	if grantee.DisplayName != nil {
		return aws.ToString(grantee.DisplayName)
	}
	return ""
}

func detectS3CannedACL(grants []s3types.Grant) string {
	const (
		allUsersURL    = "http://acs.amazonaws.com/groups/global/AllUsers"
		authUsersURL   = "http://acs.amazonaws.com/groups/global/AuthenticatedUsers"
		logDeliveryURL = "http://acs.amazonaws.com/groups/s3/LogDelivery"
	)
	var (
		ownerFullControl bool
		allUsersRead     bool
		allUsersWrite    bool
		authUsersRead    bool
	)

	for _, grant := range grants {
		if grant.Grantee == nil {
			continue
		}
		switch aws.ToString(grant.Grantee.URI) {
		case allUsersURL:
			if grant.Permission == s3types.PermissionRead {
				allUsersRead = true
			}
			if grant.Permission == s3types.PermissionWrite {
				allUsersWrite = true
			}
		case authUsersURL:
			if grant.Permission == s3types.PermissionRead {
				authUsersRead = true
			}
		case logDeliveryURL:
			// ignore log delivery grants when detecting canonical ACLs
		default:
			if grant.Grantee.Type == s3types.TypeCanonicalUser && grant.Permission == s3types.PermissionFullControl {
				ownerFullControl = true
			}
		}
	}

	switch {
	case ownerFullControl && allUsersRead && allUsersWrite:
		return string(s3types.ObjectCannedACLPublicReadWrite)
	case ownerFullControl && allUsersRead:
		return string(s3types.ObjectCannedACLPublicRead)
	case ownerFullControl && authUsersRead:
		return string(s3types.ObjectCannedACLAuthenticatedRead)
	case ownerFullControl && !allUsersRead && !allUsersWrite && !authUsersRead:
		return string(s3types.ObjectCannedACLPrivate)
	default:
		return ""
	}
}
