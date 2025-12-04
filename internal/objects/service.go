package objects

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"can/internal/accounts"
	"can/internal/providers"
)

// Service exposes object CRUD operations.
type Service struct {
	accounts *accounts.Service
	factory  providers.S3ClientFactory
}

// NewService wires dependencies for object management.
func NewService(accounts *accounts.Service, factory providers.S3ClientFactory) *Service {
	return &Service{accounts: accounts, factory: factory}
}

// ListObjects returns a single page of objects for the requested prefix.
func (s *Service) ListObjects(ctx context.Context, accountID string, input ListObjectsInput) (ListObjectsResult, error) {
	var result ListObjectsResult
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	bucket := strings.TrimSpace(input.Bucket)
	if bucket == "" {
		return result, errors.New("bucket is required")
	}
	params := &s3.ListObjectsV2Input{Bucket: aws.String(bucket)}
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
	out, err := client.ListObjectsV2(ctx, params)
	if err != nil {
		return result, providers.WrapS3Error("列出对象", err)
	}
	entries := make([]ObjectInfo, 0, len(out.CommonPrefixes)+len(out.Contents))
	for _, prefix := range out.CommonPrefixes {
		key := aws.ToString(prefix.Prefix)
		entries = append(entries, ObjectInfo{
			Key:   key,
			IsDir: true,
		})
	}
	for _, obj := range out.Contents {
		entries = append(entries, ObjectInfo{
			Key:          aws.ToString(obj.Key),
			Size:         aws.ToInt64(obj.Size),
			LastModified: aws.ToTime(obj.LastModified),
			ETag:         strings.Trim(aws.ToString(obj.ETag), `"`),
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
	result.Truncated = aws.ToBool(out.IsTruncated)
	result.NextMarker = aws.ToString(out.NextContinuationToken)
	return result, nil
}

// UploadObject streams the local file to the selected bucket.
func (s *Service) UploadObject(ctx context.Context, accountID, bucket, key, filePath string) error {
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return errors.New("object key is required")
	}
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat file: %w", err)
	}
	contentType := detectContentType(key)
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(bucket),
		Key:           aws.String(key),
		Body:          file,
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(stat.Size()),
	})
	if err != nil {
		return providers.WrapS3Error("上传对象", err)
	}
	return nil
}

// DownloadObject saves the remote object into the provided path.
func (s *Service) DownloadObject(ctx context.Context, accountID, bucket, key, savePath string) error {
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return errors.New("object key is required")
	}
	resp, err := client.GetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)})
	if err != nil {
		return providers.WrapS3Error("下载对象", err)
	}
	defer resp.Body.Close()
	target := strings.TrimSpace(savePath)
	if target == "" {
		target = filepath.Join(os.TempDir(), filepath.Base(key))
	}
	info, err := os.Stat(target)
	if err == nil && info.IsDir() {
		target = filepath.Join(target, filepath.Base(key))
	} else {
		dir := filepath.Dir(target)
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return fmt.Errorf("create parent dir: %w", err)
		}
	}
	file, err := os.Create(target)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer file.Close()
	if _, err := io.Copy(file, resp.Body); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	return nil
}

// DeleteObject removes a single object from the bucket.
func (s *Service) DeleteObject(ctx context.Context, accountID, bucket, key string) error {
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return errors.New("object key is required")
	}
	if _, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)}); err != nil {
		return providers.WrapS3Error("删除对象", err)
	}
	return nil
}

// CopyObject duplicates an object between buckets/keys.
func (s *Service) CopyObject(ctx context.Context, accountID, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(sourceBucket) == "" || strings.TrimSpace(sourceKey) == "" {
		return errors.New("source bucket/key is required")
	}
	if strings.TrimSpace(targetBucket) == "" || strings.TrimSpace(targetKey) == "" {
		return errors.New("target bucket/key is required")
	}
	copySource := fmt.Sprintf("%s/%s", sourceBucket, escapeCopyKey(sourceKey))
	_, err = client.CopyObject(ctx, &s3.CopyObjectInput{
		Bucket:     aws.String(targetBucket),
		Key:        aws.String(targetKey),
		CopySource: aws.String(copySource),
	})
	if err != nil {
		return providers.WrapS3Error("复制对象", err)
	}
	return nil
}

// HeadObject fetches metadata for a single object.
func (s *Service) HeadObject(ctx context.Context, accountID, bucket, key string) (ObjectInfo, error) {
	var info ObjectInfo
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return info, err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return info, errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return info, errors.New("object key is required")
	}
	out, err := client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: aws.String(bucket), Key: aws.String(key)})
	if err != nil {
		return info, providers.WrapS3Error("获取对象信息", err)
	}
	info = ObjectInfo{
		Key:          key,
		Size:         aws.ToInt64(out.ContentLength),
		LastModified: aws.ToTime(out.LastModified),
		ETag:         strings.Trim(aws.ToString(out.ETag), `"`),
		ContentType:  aws.ToString(out.ContentType),
		IsDir:        false,
	}
	return info, nil
}

func (s *Service) client(ctx context.Context, accountID string) (providers.S3Client, providers.ConnectionCredentials, error) {
	if strings.TrimSpace(accountID) == "" {
		return nil, providers.ConnectionCredentials{}, errors.New("account id is required")
	}
	creds, err := s.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	client, err := s.factory.NewClient(ctx, creds)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	return client, creds, nil
}

func detectContentType(key string) string {
	ext := strings.ToLower(filepath.Ext(key))
	if ext == "" {
		return "application/octet-stream"
	}
	if mimeType := mime.TypeByExtension(ext); mimeType != "" {
		return mimeType
	}
	return "application/octet-stream"
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
