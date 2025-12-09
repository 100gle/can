package objects

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/security"
	"can/internal/transfer"

	"github.com/google/uuid"
	"github.com/skip2/go-qrcode"
)

// Service exposes object CRUD operations.
type Service struct {
	accounts  *accounts.Service
	pool      providers.ClientPool
	transfers *transfer.Service
	history   LinkHistoryStore
	audit     *security.Service
}

// NewService wires dependencies for object management.
func NewService(accounts *accounts.Service, pool providers.ClientPool, transfers *transfer.Service, history LinkHistoryStore, audit *security.Service) *Service {
	if history == nil {
		history = NewMemoryLinkHistoryStore()
	}
	return &Service{accounts: accounts, pool: pool, transfers: transfers, history: history, audit: audit}
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
		items = append(items, toObjectInfo(object))
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
	return s.DownloadObjectWithOptions(ctx, accountID, DownloadObjectInput{
		Bucket:   bucket,
		Key:      key,
		SavePath: savePath,
	})
}

// DownloadObjectWithOptions allows callers to customize download behavior.
func (s *Service) DownloadObjectWithOptions(ctx context.Context, accountID string, input DownloadObjectInput) (*transfer.TransferTask, error) {
	if s.transfers == nil {
		return nil, errors.New("transfer service not configured")
	}
	req := transfer.DownloadRequest{
		AccountID:        accountID,
		Bucket:           input.Bucket,
		Key:              input.Key,
		SavePath:         input.SavePath,
		TargetDirectory:  input.TargetDirectory,
		ConflictStrategy: parseConflictStrategy(input.ConflictStrategy),
		DisableResume:    input.DisableResume,
		VersionID:        input.VersionID,
		ExpectedETag:     input.ExpectedETag,
	}
	return s.transfers.EnqueueDownload(ctx, req)
}

// DownloadBatch bundles multiple objects into a single archive download.
func (s *Service) DownloadBatch(ctx context.Context, accountID string, input DownloadBatchInput) (*transfer.TransferTask, error) {
	if s.transfers == nil {
		return nil, errors.New("transfer service not configured")
	}
	entries := make([]transfer.DownloadEntry, 0, len(input.Entries))
	for _, entry := range input.Entries {
		entries = append(entries, transfer.DownloadEntry{
			Bucket:       entry.Bucket,
			Key:          entry.Key,
			RelativePath: entry.RelativePath,
			Size:         entry.Size,
			VersionID:    entry.VersionID,
			IsDir:        entry.IsDir,
		})
	}
	req := transfer.DownloadRequest{
		AccountID:        accountID,
		Bucket:           input.Bucket,
		Mode:             transfer.DownloadModeArchive,
		Entries:          entries,
		ArchiveName:      input.ArchiveName,
		TargetDirectory:  input.TargetDirectory,
		ConflictStrategy: parseConflictStrategy(input.ConflictStrategy),
	}
	return s.transfers.EnqueueDownload(ctx, req)
}

// DeleteObject removes a single object from the bucket.
func (s *Service) DeleteObject(ctx context.Context, accountID, bucket, key string, opts ...MutationOption) error {
	meta := applyMutationOptions(opts)
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
	if skip, err := s.shouldSkipMutation(ctx, meta); err != nil {
		return err
	} else if skip {
		return nil
	}
	err = client.Objects().DeleteObject(ctx, bucket, key)
	s.logMutation(ctx, "DeleteObject", fmt.Sprintf("%s/%s", bucket, key), accountID, err, meta)
	return err
}

// BatchDeleteObjects removes multiple objects from the bucket.
func (s *Service) BatchDeleteObjects(ctx context.Context, accountID, bucket string, keys []string) (BatchDeleteResult, error) {
	var result BatchDeleteResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return result, errors.New("bucket is required")
	}
	result.Total = len(keys)
	driver := client.Objects()

	// Use the batch DeleteObjects API for better performance
	driverResult, err := driver.DeleteObjects(ctx, bucket, keys)
	if err != nil {
		// Fallback to individual delete on error
		for _, key := range keys {
			key = strings.TrimSpace(key)
			if key == "" {
				continue
			}
			resource := fmt.Sprintf("%s/%s", bucket, key)
			if err := driver.DeleteObject(ctx, bucket, key); err != nil {
				result.Failed = append(result.Failed, BatchOperationFailure{
					Bucket: bucket,
					Key:    key,
					Error:  err.Error(),
				})
				s.logMutation(ctx, "BatchDeleteObjects", resource, accountID, err, mutationContext{})
			} else {
				result.Succeeded++
				s.logMutation(ctx, "BatchDeleteObjects", resource, accountID, nil, mutationContext{})
			}
		}
		return result, nil
	}

	// Collect results from batch operation
	result.Succeeded = len(driverResult.Deleted)
	for _, delErr := range driverResult.Errors {
		result.Failed = append(result.Failed, BatchOperationFailure{
			Bucket: bucket,
			Key:    delErr.Key,
			Error:  delErr.Message,
		})
	}

	// Log the batch operation
	if len(result.Failed) > 0 {
		s.logMutation(ctx, "BatchDeleteObjects", fmt.Sprintf("%s: %d/%d failed", bucket, len(result.Failed), result.Total), accountID, fmt.Errorf("%d deletions failed", len(result.Failed)), mutationContext{})
	} else {
		s.logMutation(ctx, "BatchDeleteObjects", fmt.Sprintf("%s: %d objects", bucket, result.Succeeded), accountID, nil, mutationContext{})
	}

	return result, nil
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
func (s *Service) RenameObject(ctx context.Context, accountID, bucket, oldKey, newKey string, opts ...MutationOption) error {
	meta := applyMutationOptions(opts)
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
	if skip, err := s.shouldSkipMutation(ctx, meta); err != nil {
		return err
	} else if skip {
		return nil
	}
	resource := fmt.Sprintf("%s/%s->%s", bucket, oldKey, newKey)
	if _, err := driver.HeadObject(ctx, bucket, newKey); err == nil {
		return fmt.Errorf("object %q already exists", newKey)
	} else if err != nil && !isNotFoundError(err) {
		return err
	}
	if err := driver.CopyObject(ctx, bucket, oldKey, bucket, newKey); err != nil {
		s.logMutation(ctx, "RenameObject", resource, accountID, err, meta)
		return err
	}
	if err := driver.DeleteObject(ctx, bucket, oldKey); err != nil {
		s.logMutation(ctx, "RenameObject", resource, accountID, err, meta)
		return err
	}
	s.logMutation(ctx, "RenameObject", resource, accountID, nil, meta)
	return nil
}

// MoveObjects copies objects to their new destination and deletes the originals.
func (s *Service) MoveObjects(ctx context.Context, accountID string, requests []MoveObjectRequest, opts ...MutationOption) (MoveObjectsResult, error) {
	meta := applyMutationOptions(opts)
	var result MoveObjectsResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	driver := client.Objects()
	result.Total = len(requests)
	if skip, err := s.shouldSkipMutation(ctx, meta); err != nil {
		return result, err
	} else if skip {
		result.Succeeded = result.Total
		return result, nil
	}
	for _, req := range requests {
		srcBucket := strings.TrimSpace(req.SourceBucket)
		srcKey := strings.TrimSpace(req.SourceKey)
		dstBucket := strings.TrimSpace(req.TargetBucket)
		dstKey := strings.TrimSpace(req.TargetKey)
		if srcBucket == "" || srcKey == "" || dstBucket == "" || dstKey == "" {
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: srcBucket,
				Key:    srcKey,
				Error:  "source/target bucket and key are required",
			})
			continue
		}
		if srcBucket == dstBucket && srcKey == dstKey {
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: srcBucket,
				Key:    srcKey,
				Error:  "target must be different from source",
			})
			continue
		}
		if err := driver.CopyObject(ctx, srcBucket, srcKey, dstBucket, dstKey); err != nil {
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: srcBucket,
				Key:    srcKey,
				Error:  err.Error(),
			})
			continue
		}
		if err := driver.DeleteObject(ctx, srcBucket, srcKey); err != nil {
			cleanupErr := driver.DeleteObject(ctx, dstBucket, dstKey)
			message := fmt.Sprintf("删除源对象失败: %v", err)
			if cleanupErr != nil {
				message = fmt.Sprintf("%s；目标对象已复制但无法回滚：%v", message, cleanupErr)
			} else {
				message = fmt.Sprintf("%s；已回滚目标对象", message)
			}
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: srcBucket,
				Key:    srcKey,
				Error:  message,
			})
			continue
		}
		result.Succeeded++
	}
	var opErr error
	if len(result.Failed) > 0 {
		opErr = fmt.Errorf("%d move operations failed", len(result.Failed))
	}
	s.logMutation(ctx, "MoveObjects", fmt.Sprintf("move:%d", len(requests)), accountID, opErr, meta)
	return result, nil
}

// CreateFolder creates a zero-byte object to represent a pseudo-folder.
func (s *Service) CreateFolder(ctx context.Context, accountID, bucket, prefix string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	key := strings.TrimSpace(prefix)
	key = strings.Trim(key, " ")
	key = strings.TrimPrefix(key, "/")
	if key == "" {
		return errors.New("folder name is required")
	}
	if !strings.HasSuffix(key, "/") {
		key += "/"
	}
	body := bytes.NewReader(nil)
	return client.Objects().UploadObject(ctx, bucket, key, body, 0, "application/x-directory")
}

// CreateSymlink materialises an OSS-style symbolic link referencing another object key.
func (s *Service) CreateSymlink(ctx context.Context, accountID, bucket, linkKey, targetKey string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return errors.New("bucket is required")
	}
	linkKey = strings.TrimSpace(linkKey)
	targetKey = strings.TrimSpace(targetKey)
	if linkKey == "" || targetKey == "" {
		return errors.New("link key 与目标 key 均不能为空")
	}
	return client.Objects().CreateSymlink(ctx, bucket, linkKey, targetKey)
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
	info = toObjectInfo(raw)
	return info, nil
}

// GetObjectAttributes gathers metadata, tags and ACL information for the object.
func (s *Service) GetObjectAttributes(ctx context.Context, accountID, bucket, key string) (ObjectAttributes, error) {
	var attrs ObjectAttributes
	client, err := s.client(ctx, accountID)
	if err != nil {
		return attrs, err
	}
	driver := client.Objects()
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return attrs, errors.New("bucket is required")
	}
	key = strings.TrimSpace(key)
	if key == "" {
		return attrs, errors.New("object key is required")
	}
	desc, err := driver.HeadObject(ctx, bucket, key)
	if err != nil {
		return attrs, err
	}
	attrs.Object = toObjectInfo(desc)
	attrs.Metadata = cloneStringMap(desc.Metadata)
	if tags, err := driver.GetObjectTags(ctx, bucket, key); err == nil {
		attrs.Tags = tags
	} else if err != nil && !errors.Is(err, providers.ErrUnsupportedCapability) {
		return attrs, err
	}
	if acl, err := driver.GetObjectACL(ctx, bucket, key); err == nil {
		attrs.ACL = acl.Canned
		attrs.OwnerID = acl.OwnerID
		attrs.OwnerName = acl.OwnerDisplayName
		attrs.Grants = convertAccessGrants(acl.Grants)
	} else if err != nil && !errors.Is(err, providers.ErrUnsupportedCapability) {
		return attrs, err
	}
	return attrs, nil
}

// UpdateObjectAttributes applies metadata/tag/ACL changes to a single object and returns the updated attributes.
func (s *Service) UpdateObjectAttributes(ctx context.Context, accountID string, patch ObjectAttributesPatch) (ObjectAttributes, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return ObjectAttributes{}, err
	}
	if err := applyObjectPatch(ctx, client.Objects(), patch); err != nil {
		return ObjectAttributes{}, err
	}
	return s.GetObjectAttributes(ctx, accountID, patch.Bucket, patch.Key)
}

// BatchUpdateObjectAttributes best-effort applies patches to multiple objects.
func (s *Service) BatchUpdateObjectAttributes(ctx context.Context, accountID string, patches []ObjectAttributesPatch) (BatchAttributesResult, error) {
	var result BatchAttributesResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	driver := client.Objects()
	result.Total = len(patches)
	for _, patch := range patches {
		if err := applyObjectPatch(ctx, driver, patch); err != nil {
			result.Failed = append(result.Failed, BatchOperationFailure{
				Bucket: patch.Bucket,
				Key:    patch.Key,
				Error:  err.Error(),
			})
			continue
		}
		result.Succeeded++
	}
	return result, nil
}

// GetObjectLockConfiguration fetches the bucket-level object lock defaults.
func (s *Service) GetObjectLockConfiguration(ctx context.Context, accountID, bucket string) (ObjectLockConfiguration, error) {
	var cfg ObjectLockConfiguration
	client, err := s.client(ctx, accountID)
	if err != nil {
		return cfg, err
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return cfg, errors.New("bucket is required")
	}
	providerCfg, err := client.Objects().GetObjectLockConfiguration(ctx, bucket)
	if err != nil {
		return cfg, err
	}
	return convertLockConfiguration(providerCfg), nil
}

// GetObjectRetention returns current retention metadata for the object/version.
func (s *Service) GetObjectRetention(ctx context.Context, accountID, bucket, key, versionID string) (ObjectRetentionState, error) {
	var state ObjectRetentionState
	client, err := s.client(ctx, accountID)
	if err != nil {
		return state, err
	}
	bucket = strings.TrimSpace(bucket)
	key = strings.TrimSpace(key)
	if bucket == "" || key == "" {
		return state, errors.New("bucket and key are required")
	}
	providerState, err := client.Objects().GetObjectRetention(ctx, bucket, key, versionID)
	if err != nil {
		return state, err
	}
	return convertRetentionState(providerState), nil
}

// UpdateObjectRetention applies a new retention policy for the object/version and returns the resulting state.
func (s *Service) UpdateObjectRetention(ctx context.Context, accountID string, input UpdateObjectRetentionInput) (ObjectRetentionState, error) {
	var state ObjectRetentionState
	client, err := s.client(ctx, accountID)
	if err != nil {
		return state, err
	}
	input.Bucket = strings.TrimSpace(input.Bucket)
	input.Key = strings.TrimSpace(input.Key)
	if input.Bucket == "" || input.Key == "" {
		return state, errors.New("bucket and key are required")
	}
	if input.RetainUntil.IsZero() {
		return state, errors.New("retain until 时间不能为空")
	}
	payload := providers.PutObjectRetentionInput{
		Bucket:           input.Bucket,
		Key:              input.Key,
		VersionID:        input.VersionID,
		Mode:             input.Mode,
		RetainUntil:      input.RetainUntil,
		BypassGovernance: input.BypassGovernance,
	}
	if err := client.Objects().PutObjectRetention(ctx, payload); err != nil {
		return state, err
	}
	return s.GetObjectRetention(ctx, accountID, input.Bucket, input.Key, input.VersionID)
}

// GetObjectLegalHold returns the current legal hold status for an object/version.
func (s *Service) GetObjectLegalHold(ctx context.Context, accountID, bucket, key, versionID string) (ObjectLegalHoldState, error) {
	var state ObjectLegalHoldState
	client, err := s.client(ctx, accountID)
	if err != nil {
		return state, err
	}
	bucket = strings.TrimSpace(bucket)
	key = strings.TrimSpace(key)
	if bucket == "" || key == "" {
		return state, errors.New("bucket and key are required")
	}
	providerState, err := client.Objects().GetObjectLegalHold(ctx, bucket, key, versionID)
	if err != nil {
		return state, err
	}
	return convertLegalHoldState(providerState), nil
}

// UpdateObjectLegalHold toggles the legal hold status for an object/version.
func (s *Service) UpdateObjectLegalHold(ctx context.Context, accountID string, input UpdateObjectLegalHoldInput) (ObjectLegalHoldState, error) {
	var state ObjectLegalHoldState
	client, err := s.client(ctx, accountID)
	if err != nil {
		return state, err
	}
	input.Bucket = strings.TrimSpace(input.Bucket)
	input.Key = strings.TrimSpace(input.Key)
	if input.Bucket == "" || input.Key == "" {
		return state, errors.New("bucket and key are required")
	}
	if strings.TrimSpace(input.Status) == "" {
		return state, errors.New("status is required")
	}
	payload := providers.PutObjectLegalHoldInput{
		Bucket:    input.Bucket,
		Key:       input.Key,
		VersionID: input.VersionID,
		Status:    input.Status,
	}
	if err := client.Objects().PutObjectLegalHold(ctx, payload); err != nil {
		return state, err
	}
	return s.GetObjectLegalHold(ctx, accountID, input.Bucket, input.Key, input.VersionID)
}

// GetPresignedURL generates a time-bound URL for downloading or uploading objects.
func (s *Service) GetPresignedURL(
	ctx context.Context,
	accountID, bucket, key string,
	expirationSeconds int64,
	method string,
) (string, error) {
	return s.GetPresignedURLWithHeaders(ctx, accountID, bucket, key, expirationSeconds, method, nil)
}

// GetPresignedURLWithHeaders allows callers to override response headers on the generated URL.
func (s *Service) GetPresignedURLWithHeaders(
	ctx context.Context,
	accountID, bucket, key string,
	expirationSeconds int64,
	method string,
	headers map[string]string,
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
	url, err := client.Objects().PresignURL(ctx, providers.PresignRequest{
		Bucket:          bucket,
		Key:             key,
		Method:          method,
		Expiration:      duration,
		ResponseHeaders: cloneHeaders(headers),
	})
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

// GenerateAccessLinks builds presigned URLs (one per method) and stores them in history.
func (s *Service) GenerateAccessLinks(ctx context.Context, accountID string, input AccessLinkRequest) ([]AccessLink, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return nil, err
	}
	bucket := strings.TrimSpace(input.Bucket)
	key := strings.TrimSpace(input.Key)
	if bucket == "" {
		return nil, errors.New("bucket is required")
	}
	if key == "" {
		return nil, errors.New("object key is required")
	}
	methods := normalizeMethods(input.Methods)
	expiresIn := normalizeExpiration(input.ExpirationSeconds)
	baseHeaders := mergeResponseHeaders(input.FileName, input.ResponseHeaders)
	label := input.FileName
	if strings.TrimSpace(label) == "" {
		label = filepath.Base(key)
	}
	results := make([]AccessLink, 0, len(methods))
	now := time.Now()
	if s.history != nil {
		_ = s.history.Cleanup(ctx, now)
	}
	for _, method := range methods {
		req := providers.PresignRequest{
			Bucket:          bucket,
			Key:             key,
			Method:          method,
			Expiration:      expiresIn,
			VersionID:       input.VersionID,
			ResponseHeaders: baseHeaders,
		}
		url, err := client.Objects().PresignURL(ctx, req)
		if err != nil {
			return nil, err
		}
		qr, err := qrDataURI(url)
		if err != nil {
			return nil, err
		}
		expiresAt := now.Add(expiresIn)
		entry := LinkHistoryEntry{
			ID:              uuid.NewString(),
			AccountID:       accountID,
			Bucket:          bucket,
			Key:             key,
			Method:          method,
			URL:             url,
			FileName:        input.FileName,
			ExpiresAt:       expiresAt,
			CreatedAt:       now,
			ResponseHeaders: cloneHeaders(baseHeaders),
		}
		if s.history != nil {
			if err := s.history.Save(ctx, &entry); err != nil {
				return nil, err
			}
		}
		results = append(results, AccessLink{
			ID:              entry.ID,
			Method:          method,
			URL:             url,
			ExpiresAt:       expiresAt,
			Markdown:        fmt.Sprintf("[%s](%s)", label, url),
			HTML:            fmt.Sprintf("<a href=\"%s\">%s</a>", url, label),
			QRCode:          qr,
			ResponseHeaders: cloneHeaders(baseHeaders),
		})
	}
	return results, nil
}

// ListAccessLinkHistory returns the latest generated links for an account.
func (s *Service) ListAccessLinkHistory(ctx context.Context, accountID string, limit int) ([]LinkHistoryEntry, error) {
	if s.history == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = 20
	}
	if err := s.history.Cleanup(ctx, time.Now()); err != nil {
		return nil, err
	}
	return s.history.List(ctx, accountID, limit)
}

// DeleteAccessLinkHistory removes a saved link from history.
func (s *Service) DeleteAccessLinkHistory(ctx context.Context, accountID, id string) error {
	if s.history == nil {
		return nil
	}
	return s.history.Delete(ctx, accountID, strings.TrimSpace(id))
}

func (s *Service) shouldSkipMutation(ctx context.Context, meta mutationContext) (bool, error) {
	if meta.requestID == "" || s.audit == nil {
		return false, nil
	}
	return s.audit.HasRequest(ctx, meta.requestID)
}

func (s *Service) logMutation(ctx context.Context, action, resource, accountID string, opErr error, meta mutationContext) {
	if s.audit == nil {
		return
	}
	status := "Success"
	details := ""
	if opErr != nil {
		status = "Failure"
		details = opErr.Error()
	}
	var opts []security.LogOption
	if meta.origin != "" {
		opts = append(opts, security.WithOrigin(meta.origin))
	}
	if meta.requestID != "" {
		opts = append(opts, security.WithRequestID(meta.requestID))
	}
	_ = s.audit.Log(ctx, action, resource, accountID, status, details, opts...)
}

func (s *Service) client(ctx context.Context, accountID string) (providers.StorageClient, error) {
	client, _, err := s.accounts.GetStorageClient(ctx, s.pool, accountID)
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

func toObjectInfo(desc providers.ObjectDescriptor) ObjectInfo {
	return ObjectInfo{
		Key:           desc.Key,
		Size:          desc.Size,
		LastModified:  desc.LastModified,
		ETag:          desc.ETag,
		ContentType:   desc.ContentType,
		StorageClass:  desc.StorageClass,
		VersionID:     desc.VersionID,
		IsDir:         desc.IsDir,
		Metadata:      cloneStringMap(desc.Metadata),
		IsSymlink:     desc.IsSymlink,
		SymlinkTarget: desc.SymlinkTarget,
	}
}

func cloneStringMap(input map[string]string) map[string]string {
	if len(input) == 0 {
		return nil
	}
	clone := make(map[string]string, len(input))
	for k, v := range input {
		clone[k] = v
	}
	return clone
}

func convertLockConfiguration(cfg providers.ObjectLockConfiguration) ObjectLockConfiguration {
	return ObjectLockConfiguration{
		Enabled:        cfg.Enabled,
		Mode:           cfg.Mode,
		RetentionDays:  cfg.RetentionDays,
		RetentionYears: cfg.RetentionYears,
	}
}

func convertRetentionState(state providers.ObjectRetentionState) ObjectRetentionState {
	return ObjectRetentionState{
		Mode:        state.Mode,
		RetainUntil: state.RetainUntil,
	}
}

func convertLegalHoldState(state providers.ObjectLegalHoldState) ObjectLegalHoldState {
	return ObjectLegalHoldState{
		Status: state.Status,
	}
}

func applyObjectPatch(ctx context.Context, driver providers.ObjectDriver, patch ObjectAttributesPatch) error {
	bucket := strings.TrimSpace(patch.Bucket)
	key := strings.TrimSpace(patch.Key)
	if bucket == "" || key == "" {
		return errors.New("bucket and key are required")
	}
	var unsupported []string
	applied := false
	if patch.Metadata != nil || patch.ContentType != "" || patch.StorageClass != "" {
		update := providers.ObjectMetadataUpdate{
			Metadata:     patch.Metadata,
			ContentType:  patch.ContentType,
			StorageClass: patch.StorageClass,
		}
		if err := driver.UpdateObjectMetadata(ctx, bucket, key, update); err != nil {
			if errors.Is(err, providers.ErrUnsupportedCapability) {
				unsupported = appendUnsupported(unsupported, "metadata")
			} else {
				return err
			}
		} else {
			applied = true
		}
	}
	if patch.Tags != nil {
		if err := driver.PutObjectTags(ctx, bucket, key, patch.Tags); err != nil {
			if errors.Is(err, providers.ErrUnsupportedCapability) {
				unsupported = appendUnsupported(unsupported, "tags")
			} else {
				return err
			}
		} else {
			applied = true
		}
	}
	if acl := strings.TrimSpace(patch.ACL); acl != "" {
		if err := driver.PutObjectACL(ctx, bucket, key, acl); err != nil {
			if errors.Is(err, providers.ErrUnsupportedCapability) {
				unsupported = appendUnsupported(unsupported, "acl")
			} else {
				return err
			}
		} else {
			applied = true
		}
	}
	if len(unsupported) > 0 && !applied {
		return fmt.Errorf("当前存储供应商不支持以下操作：%s", strings.Join(unsupported, "、"))
	}
	return nil
}

func appendUnsupported(list []string, feature string) []string {
	for _, existing := range list {
		if existing == feature {
			return list
		}
	}
	return append(list, feature)
}

func convertAccessGrants(grants []providers.AccessGrant) []AccessGrant {
	if len(grants) == 0 {
		return nil
	}
	out := make([]AccessGrant, 0, len(grants))
	for _, grant := range grants {
		out = append(out, AccessGrant{
			GranteeType: grant.GranteeType,
			Grantee:     grant.Grantee,
			Permission:  grant.Permission,
		})
	}
	return out
}

func parseConflictStrategy(value string) transfer.FileConflictStrategy {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case string(transfer.ConflictStrategyRename):
		return transfer.ConflictStrategyRename
	default:
		return transfer.ConflictStrategyOverwrite
	}
}

func normalizeMethods(methods []string) []string {
	result := make([]string, 0, len(methods))
	for _, method := range methods {
		trimmed := strings.ToUpper(strings.TrimSpace(method))
		if trimmed == "" {
			continue
		}
		switch trimmed {
		case http.MethodGet, http.MethodPut, http.MethodHead, http.MethodDelete:
			result = append(result, trimmed)
		}
	}
	if len(result) == 0 {
		return []string{http.MethodGet}
	}
	return result
}

func normalizeExpiration(seconds int64) time.Duration {
	if seconds <= 0 {
		return time.Hour
	}
	max := int64((7 * 24 * time.Hour) / time.Second)
	if seconds > max {
		seconds = max
	}
	return time.Duration(seconds) * time.Second
}

func mergeResponseHeaders(fileName string, headers map[string]string) map[string]string {
	merged := make(map[string]string, len(headers)+1)
	for k, v := range headers {
		if strings.TrimSpace(k) == "" || strings.TrimSpace(v) == "" {
			continue
		}
		merged[strings.ToLower(k)] = v
	}
	if strings.TrimSpace(fileName) != "" {
		disposition := fmt.Sprintf("attachment; filename=\"%s\"", fileName)
		merged["content-disposition"] = disposition
	}
	return merged
}

func cloneHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	clone := make(map[string]string, len(headers))
	for k, v := range headers {
		clone[k] = v
	}
	return clone
}

func qrDataURI(url string) (string, error) {
	if strings.TrimSpace(url) == "" {
		return "", errors.New("url is required")
	}
	png, err := qrcode.Encode(url, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}
	encoded := base64.StdEncoding.EncodeToString(png)
	return "data:image/png;base64," + encoded, nil
}
