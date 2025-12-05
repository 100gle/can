package objects

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/transfer"
)

// Service exposes object CRUD operations.
type Service struct {
	accounts  *accounts.Service
	pool      providers.ClientPool
	transfers *transfer.Service
}

// NewService wires dependencies for object management.
func NewService(accounts *accounts.Service, pool providers.ClientPool, transfers *transfer.Service) *Service {
	return &Service{accounts: accounts, pool: pool, transfers: transfers}
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

// UploadObject enqueues an upload task handled by the transfer service.
func (s *Service) UploadObject(ctx context.Context, accountID, bucket, key, filePath string) (*transfer.TransferTask, error) {
	if s.transfers == nil {
		return nil, errors.New("transfer service not configured")
	}
	return s.transfers.EnqueueUpload(ctx, transfer.UploadRequest{
		AccountID: accountID,
		Bucket:    bucket,
		Key:       key,
		FilePath:  filePath,
	})
}

// DownloadObject enqueues a download task handled by the transfer service.
func (s *Service) DownloadObject(ctx context.Context, accountID, bucket, key, savePath string) (*transfer.TransferTask, error) {
	if s.transfers == nil {
		return nil, errors.New("transfer service not configured")
	}
	return s.transfers.EnqueueDownload(ctx, transfer.DownloadRequest{
		AccountID: accountID,
		Bucket:    bucket,
		Key:       key,
		SavePath:  savePath,
	})
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

// RenameObject renames an object by copying it to the new key and deleting the old key.
func (s *Service) RenameObject(ctx context.Context, accountID, bucket, oldKey, newKey string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	oldKey = strings.TrimSpace(oldKey)
	if oldKey == "" {
		return errors.New("current object key is required")
	}
	newKey = strings.TrimSpace(newKey)
	if newKey == "" {
		return errors.New("new object key is required")
	}
	if oldKey == newKey {
		return errors.New("new object key must be different from the current key")
	}
	driver := client.Objects()
	if _, err := driver.HeadObject(ctx, bucket, newKey); err == nil {
		return fmt.Errorf("object %q already exists", newKey)
	} else if err != nil && !isNotFoundError(err) {
		return err
	}
	if err := driver.CopyObject(ctx, bucket, oldKey, bucket, newKey); err != nil {
		return err
	}
	if err := driver.DeleteObject(ctx, bucket, oldKey); err != nil {
		return err
	}
	return nil
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

// GetPresignedURL generates a time-bound URL for downloading or uploading objects.
func (s *Service) GetPresignedURL(
	ctx context.Context,
	accountID, bucket, key string,
	expirationSeconds int64,
	method string,
) (string, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return "", err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return "", errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", errors.New("object key is required")
	}
	if expirationSeconds <= 0 {
		expirationSeconds = int64(time.Hour / time.Second)
	}
	maxTTL := int64((7 * 24 * time.Hour) / time.Second)
	if expirationSeconds > maxTTL {
		expirationSeconds = maxTTL
	}
	duration := time.Duration(expirationSeconds) * time.Second
	url, err := client.Objects().PresignURL(ctx, bucket, key, duration, method)
	if err != nil {
		return "", err
	}
	return url, nil
}

// InitiateMultipartUpload starts a multipart upload session.
func (s *Service) InitiateMultipartUpload(ctx context.Context, accountID, bucket, key string) (string, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return "", err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return "", errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return "", errors.New("object key is required")
	}
	return client.Objects().InitiateMultipartUpload(ctx, bucket, key)
}

// UploadPart uploads a single part for a multipart session.
func (s *Service) UploadPart(
	ctx context.Context,
	accountID, bucket, key, uploadID string,
	partNumber int,
	data []byte,
) (string, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return "", err
	}
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
	if len(data) == 0 {
		return "", errors.New("part payload is empty")
	}
	reader := bytes.NewReader(data)
	return client.Objects().UploadPart(ctx, bucket, key, uploadID, partNumber, reader, int64(len(data)))
}

// CompleteMultipartUpload finalises the multipart upload with the collected ETags.
func (s *Service) CompleteMultipartUpload(
	ctx context.Context,
	accountID, bucket, key, uploadID string,
	parts map[int]string,
) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
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
	return client.Objects().CompleteMultipartUpload(ctx, bucket, key, uploadID, parts)
}

// AbortMultipartUpload cancels an in-progress multipart upload.
func (s *Service) AbortMultipartUpload(ctx context.Context, accountID, bucket, key, uploadID string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if strings.TrimSpace(bucket) == "" {
		return errors.New("bucket is required")
	}
	if strings.TrimSpace(key) == "" {
		return errors.New("object key is required")
	}
	if strings.TrimSpace(uploadID) == "" {
		return errors.New("upload id is required")
	}
	return client.Objects().AbortMultipartUpload(ctx, bucket, key, uploadID)
}

func (s *Service) client(ctx context.Context, accountID string) (providers.StorageClient, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, errors.New("account id is required")
	}
	if s.pool == nil {
		return nil, errors.New("storage client pool not configured")
	}
	supplier := func(ctx context.Context) (providers.ConnectionCredentials, error) {
		return s.accounts.ConnectionCredentials(ctx, accountID)
	}
	client, _, err := s.pool.Get(ctx, accountID, supplier)
	if err != nil {
		return nil, err
	}
	return client, nil
}

func isNotFoundError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "notfound") ||
		strings.Contains(msg, "not found") ||
		strings.Contains(msg, "not exist") ||
		strings.Contains(msg, "nosuchkey") ||
		strings.Contains(msg, "no such key") ||
		strings.Contains(msg, "nosuchobject") ||
		strings.Contains(msg, "no such object") ||
		strings.Contains(msg, "不存在")
}
