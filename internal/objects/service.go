package objects

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"can/internal/accounts"
	"can/internal/providers"
)

// Service exposes object CRUD operations.
type Service struct {
	accounts *accounts.Service
	factory  providers.StorageFactory
}

// NewService wires dependencies for object management.
func NewService(accounts *accounts.Service, factory providers.StorageFactory) *Service {
	return &Service{accounts: accounts, factory: factory}
}

// ListObjects returns a single page of objects for the requested prefix.
func (s *Service) ListObjects(ctx context.Context, accountID string, input ListObjectsInput) (ListObjectsResult, error) {
	var result ListObjectsResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	payload := providers.ListObjectsInput{
		Bucket:    input.Bucket,
		Prefix:    input.Prefix,
		Delimiter: input.Delimiter,
		Limit:     input.Limit,
		Marker:    input.Marker,
	}
	data, err := client.Objects().ListObjects(ctx, payload)
	if err != nil {
		return result, err
	}
	items := make([]ObjectInfo, 0, len(data.Objects))
	for _, object := range data.Objects {
		items = append(items, ObjectInfo{
			Key:          object.Key,
			Size:         object.Size,
			LastModified: object.LastModified,
			ETag:         object.ETag,
			ContentType:  object.ContentType,
			IsDir:        object.IsDir,
		})
	}
	result.Objects = items
	result.Truncated = data.Truncated
	result.NextMarker = data.NextMarker
	return result, nil
}

// UploadObject streams the local file to the selected bucket.
func (s *Service) UploadObject(ctx context.Context, accountID, bucket, key, filePath string) error {
	client, err := s.client(ctx, accountID)
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
	if err := client.Objects().UploadObject(ctx, bucket, key, file, stat.Size(), contentType); err != nil {
		return err
	}
	return nil
}

// DownloadObject saves the remote object into the provided path.
func (s *Service) DownloadObject(ctx context.Context, accountID, bucket, key, savePath string) error {
	client, err := s.client(ctx, accountID)
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
	download, err := client.Objects().DownloadObject(ctx, bucket, key)
	if err != nil {
		return err
	}
	defer download.Body.Close()
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
	if _, err := io.Copy(file, download.Body); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	return nil
}

// DeleteObject removes a single object from the bucket.
func (s *Service) DeleteObject(ctx context.Context, accountID, bucket, key string) error {
	client, err := s.client(ctx, accountID)
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
	return client.Objects().DeleteObject(ctx, bucket, key)
}

// CopyObject duplicates an object between buckets/keys.
func (s *Service) CopyObject(ctx context.Context, accountID, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(sourceBucket) == "" || strings.TrimSpace(sourceKey) == "" {
		return errors.New("source bucket/key is required")
	}
	if strings.TrimSpace(targetBucket) == "" || strings.TrimSpace(targetKey) == "" {
		return errors.New("target bucket/key is required")
	}
	return client.Objects().CopyObject(ctx, sourceBucket, sourceKey, targetBucket, targetKey)
}

// HeadObject fetches metadata for a single object.
func (s *Service) HeadObject(ctx context.Context, accountID, bucket, key string) (ObjectInfo, error) {
	var info ObjectInfo
	client, err := s.client(ctx, accountID)
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
	raw, err := client.Objects().HeadObject(ctx, bucket, key)
	if err != nil {
		return info, err
	}
	info = ObjectInfo{
		Key:          raw.Key,
		Size:         raw.Size,
		LastModified: raw.LastModified,
		ETag:         raw.ETag,
		ContentType:  raw.ContentType,
		IsDir:        raw.IsDir,
	}
	return info, nil
}

func (s *Service) client(ctx context.Context, accountID string) (providers.StorageClient, error) {
	if strings.TrimSpace(accountID) == "" {
		return nil, errors.New("account id is required")
	}
	creds, err := s.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return nil, err
	}
	client, err := s.factory.NewClient(ctx, creds)
	if err != nil {
		return nil, err
	}
	return client, nil
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
