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

	"github.com/rs/zerolog/log"

	"can/internal/accounts"
	"can/internal/storage"
	"can/internal/transfer"
	"can/internal/validation"

	"github.com/google/uuid"
	"github.com/skip2/go-qrcode"
)

// Service exposes object CRUD operations.
type Service struct {
	accounts  *accounts.Service
	vault     *storage.ClientVault
	transfers *transfer.Service
}

// NewService wires dependencies for object management.
func NewService(accounts *accounts.Service, vault *storage.ClientVault, transfers *transfer.Service) *Service {
	return &Service{accounts: accounts, vault: vault, transfers: transfers}
}

// ListObjects returns a single page of objects for the requested prefix.
func (s *Service) ListObjects(ctx context.Context, accountID string, input storage.ListObjectsInput) (storage.ListObjectsResult, error) {
	if input.Limit <= 0 {
		input.Limit = 1000 // Default limit
	}
	if err := validation.ValidateStruct(input); err != nil {
		return storage.ListObjectsResult{}, err
	}
	var result storage.ListObjectsResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	data, err := client.Object.ListObjects(ctx, input)
	if err != nil {
		return result, err
	}
	data.Objects = cloneObjectDescriptors(data.Objects)
	return data, nil
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
	if err := validation.ValidateStruct(input); err != nil {
		return nil, err
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
	if err := validation.ValidateStruct(input); err != nil {
		return nil, err
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

func (s *Service) DeleteObject(ctx context.Context, accountID string, input DeleteObjectInput) error {
	return s.DeleteObjectWithOptions(ctx, accountID, input, MutationOptions{})
}

// DeleteObjectWithOptions removes an object with mutation tracking metadata.
func (s *Service) DeleteObjectWithOptions(ctx context.Context, accountID string, input DeleteObjectInput, opts MutationOptions) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	log.Info().
		Str("requestId", opts.RequestID).
		Str("origin", opts.Origin).
		Str("bucket", input.Bucket).
		Str("key", input.Key).
		Msg("objects.Service.DeleteObject")
	return client.Object.DeleteObject(ctx, input.Bucket, input.Key)
}

// BatchDeleteObjects removes multiple objects from the bucket.
func (s *Service) BatchDeleteObjects(ctx context.Context, accountID string, input BatchDeleteObjectsInput) (BatchDeleteResult, error) {
	var result BatchDeleteResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return result, err
	}
	log.Info().
		Str("bucket", input.Bucket).
		Int("count", len(input.Keys)).
		Msg("objects.Service.BatchDelete")
	keys := make([]string, 0, len(input.Keys))
	for _, key := range input.Keys {
		keys = append(keys, key)
	}
	result.Total = len(keys)
	driver := client.Object
	driverResult, err := driver.DeleteObjects(ctx, input.Bucket, keys)
	if err != nil {
		return result, err
	}
	result.Succeeded = len(driverResult.Deleted)
	for _, delErr := range driverResult.Errors {
		result.Failed = append(result.Failed, BatchOperationFailure{
			Bucket: input.Bucket,
			Key:    delErr.Key,
			Error:  delErr.Message,
		})
	}
	if len(result.Failed) > 0 {
		log.Warn().
			Str("bucket", input.Bucket).
			Int("succeeded", result.Succeeded).
			Int("failed", len(result.Failed)).
			Msg("objects.Service.BatchDelete.partial")
	}
	return result, nil
}

// CopyObject duplicates an object between buckets/keys.
func (s *Service) CopyObject(ctx context.Context, accountID string, input CopyObjectInput) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	log.Info().
		Str("accountId", accountID).
		Str("sourceBucket", input.SourceBucket).
		Str("sourceKey", input.SourceKey).
		Str("targetBucket", input.TargetBucket).
		Str("targetKey", input.TargetKey).
		Msg("objects.Service.CopyObject")
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	return client.Object.CopyObject(ctx, input.SourceBucket, input.SourceKey, input.TargetBucket, input.TargetKey)
}

func (s *Service) RenameObject(ctx context.Context, accountID string, input RenameObjectInput) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if err != nil {
		return err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	if input.OldKey == input.NewKey {
		return errors.New("new object key must be different from the current key")
	}
	driver := client.Object
	if _, err := driver.HeadObject(ctx, input.Bucket, input.NewKey); err == nil {
		return fmt.Errorf("object %q already exists", input.NewKey)
	} else if !isNotFoundError(err) {
		return err
	}
	if err := driver.CopyObject(ctx, input.Bucket, input.OldKey, input.Bucket, input.NewKey); err != nil {
		return err
	}
	if err := driver.DeleteObject(ctx, input.Bucket, input.OldKey); err != nil {
		return err
	}
	log.Info().
		Str("accountId", accountID).
		Str("bucket", input.Bucket).
		Str("oldKey", input.OldKey).
		Str("newKey", input.NewKey).
		Msg("objects.Service.RenameObject.completed")
	return nil
}

// RenameObjectWithOptions renames an object with mutation tracking metadata.
func (s *Service) RenameObjectWithOptions(ctx context.Context, accountID string, input RenameObjectInput, opts MutationOptions) error {
	log.Info().
		Str("requestId", opts.RequestID).
		Str("origin", opts.Origin).
		Str("bucket", input.Bucket).
		Str("oldKey", input.OldKey).
		Str("newKey", input.NewKey).
		Msg("objects.Service.RenameObject")
	return s.RenameObject(ctx, accountID, input)
}

func (s *Service) MoveObjects(ctx context.Context, accountID string, input MoveObjectsInput) (MoveObjectsResult, error) {
	var result MoveObjectsResult
	client, err := s.client(ctx, accountID)
	if err != nil {
		return result, err
	}
	driver := client.Object
	result.Total = len(input.Requests)
	if err := validation.ValidateStruct(input); err != nil {
		// Use partial failure or return error? MoveObjects returns result/error.
		// If input is invalid, we should probably return error immediately.
		return result, err
	}
	for _, req := range input.Requests {
		srcBucket := req.SourceBucket
		srcKey := req.SourceKey
		dstBucket := req.TargetBucket
		dstKey := req.TargetKey
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
	_ = opErr // suppress unused variable error if log is removed
	return result, nil
}

// MoveObjectsWithOptions performs batch move operations with mutation tracking metadata.
func (s *Service) MoveObjectsWithOptions(ctx context.Context, accountID string, input MoveObjectsInput, opts MutationOptions) (MoveObjectsResult, error) {
	log.Info().
		Str("requestId", opts.RequestID).
		Str("origin", opts.Origin).
		Int("count", len(input.Requests)).
		Msg("objects.Service.MoveObjects")
	return s.MoveObjects(ctx, accountID, input)
}

// CreateFolder creates a zero-byte object to represent a pseudo-folder.
func (s *Service) CreateFolder(ctx context.Context, accountID string, input CreateFolderInput) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if err != nil {
		return err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	key := input.Prefix
	key = strings.TrimPrefix(key, "/")
	if key == "" {
		return errors.New("folder name is required")
	}
	if !strings.HasSuffix(key, "/") {
		key += "/"
	}
	body := bytes.NewReader(nil)
	return client.Object.UploadObject(ctx, input.Bucket, key, body, 0, "application/x-directory")
}

// CreateSymlink materialises an OSS-style symbolic link referencing another object key.
func (s *Service) CreateSymlink(ctx context.Context, accountID, bucket, linkKey, targetKey string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	if err := validation.ValidateBucketName(bucket); err != nil {
		return err
	}
	if err := validation.ValidateObjectKey(linkKey); err != nil {
		return err
	}
	if err := validation.ValidateObjectKey(targetKey); err != nil {
		return err
	}
	return client.Object.CreateSymlink(ctx, bucket, linkKey, targetKey)
}

// GetSymlink returns the target of an OSS symlink.
func (s *Service) GetSymlink(ctx context.Context, accountID, bucket, key string) (string, error) {
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
	return client.Object.GetSymlink(ctx, bucket, key)
}

// HeadObject fetches metadata for a single object.
func (s *Service) HeadObject(ctx context.Context, accountID, bucket, key string) (storage.ObjectDescriptor, error) {
	var info storage.ObjectDescriptor
	client, err := s.client(ctx, accountID)
	if err != nil {
		return info, err
	}
	bucket = strings.TrimSpace(bucket)
	key = strings.TrimSpace(key)
	raw, err := client.Object.HeadObject(ctx, bucket, key)
	if err != nil {
		return info, err
	}
	return cloneObjectDescriptor(raw), nil
}

// GetObjectAttributes gathers metadata, tags and ACL information for the object.
func (s *Service) GetObjectAttributes(ctx context.Context, accountID, bucket, key string) (ObjectAttributes, error) {
	var attrs ObjectAttributes
	client, err := s.client(ctx, accountID)
	if err != nil {
		return attrs, err
	}
	driver := client.Object
	if err := validation.ValidateBucketName(bucket); err != nil {
		return attrs, err
	}
	if err := validation.ValidateObjectKey(key); err != nil {
		return attrs, err
	}
	desc, err := driver.HeadObject(ctx, bucket, key)
	if err != nil {
		return attrs, err
	}
	attrs.Object = cloneObjectDescriptor(desc)
	attrs.Metadata = cloneStringMap(desc.Metadata)
	if tags, err := driver.GetObjectTags(ctx, bucket, key); err == nil {
		attrs.Tags = tags
	} else if !errors.Is(err, storage.ErrUnsupportedFeature) {
		return attrs, err
	}
	if acl, err := driver.GetObjectACL(ctx, bucket, key); err == nil {
		attrs.ACL = cloneObjectACL(acl)
	} else if !errors.Is(err, storage.ErrUnsupportedFeature) {
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
	if err := applyObjectPatch(ctx, client.Object, patch); err != nil {
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
	driver := client.Object
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
func (s *Service) GetObjectLockConfiguration(ctx context.Context, accountID, bucket string) (storage.ObjectLockConfiguration, error) {
	var cfg storage.ObjectLockConfiguration
	client, err := s.client(ctx, accountID)
	if err != nil {
		return cfg, err
	}
	bucket = strings.TrimSpace(bucket)
	providerCfg, err := client.Object.GetObjectLockConfiguration(ctx, bucket)
	if err != nil {
		return cfg, err
	}
	return providerCfg, nil
}

// GetObjectRetention returns current retention metadata for the object/version.
func (s *Service) GetObjectRetention(ctx context.Context, accountID, bucket, key, versionID string) (storage.ObjectRetentionState, error) {
	var state storage.ObjectRetentionState
	client, err := s.client(ctx, accountID)
	if err != nil {
		return state, err
	}
	bucket = strings.TrimSpace(bucket)
	key = strings.TrimSpace(key)
	providerState, err := client.Object.GetObjectRetention(ctx, bucket, key, versionID)
	if err != nil {
		return state, err
	}
	return providerState, nil
}

// UpdateObjectRetention applies a new retention policy for the object/version and returns the resulting state.
func (s *Service) UpdateObjectRetention(ctx context.Context, accountID string, input UpdateObjectRetentionInput) (storage.ObjectRetentionState, error) {
	var state storage.ObjectRetentionState
	client, err := s.client(ctx, accountID)
	if err != nil {
		return state, err
	}
	if err != nil {
		return state, err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return state, err
	}
	payload := storage.PutObjectRetentionInput{
		Bucket:           input.Bucket,
		Key:              input.Key,
		VersionID:        input.VersionID,
		Mode:             input.Mode,
		RetainUntil:      input.RetainUntil,
		BypassGovernance: input.BypassGovernance,
	}
	if err := client.Object.PutObjectRetention(ctx, payload); err != nil {
		return state, err
	}
	return s.GetObjectRetention(ctx, accountID, input.Bucket, input.Key, input.VersionID)
}

// GetObjectLegalHold returns the current legal hold status for an object/version.
func (s *Service) GetObjectLegalHold(ctx context.Context, accountID, bucket, key, versionID string) (storage.ObjectLegalHoldState, error) {
	var state storage.ObjectLegalHoldState
	client, err := s.client(ctx, accountID)
	if err != nil {
		return state, err
	}
	bucket = strings.TrimSpace(bucket)
	key = strings.TrimSpace(key)
	providerState, err := client.Object.GetObjectLegalHold(ctx, bucket, key, versionID)
	if err != nil {
		return state, err
	}
	return providerState, nil
}

// UpdateObjectLegalHold toggles the legal hold status for an object/version.
func (s *Service) UpdateObjectLegalHold(ctx context.Context, accountID string, input UpdateObjectLegalHoldInput) (storage.ObjectLegalHoldState, error) {
	var state storage.ObjectLegalHoldState
	client, err := s.client(ctx, accountID)
	if err != nil {
		return state, err
	}
	if err != nil {
		return state, err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return state, err
	}
	payload := storage.PutObjectLegalHoldInput{
		Bucket:    input.Bucket,
		Key:       input.Key,
		VersionID: input.VersionID,
		Status:    input.Status,
	}
	if err := client.Object.PutObjectLegalHold(ctx, payload); err != nil {
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
	url, err := client.Object.PresignURL(ctx, storage.PresignRequest{
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
	return client.Object.InitiateMultipartUpload(ctx, bucket, key)
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
	return client.Object.UploadPart(ctx, bucket, key, uploadID, partNumber, reader, int64(len(data)))
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
	return client.Object.CompleteMultipartUpload(ctx, bucket, key, uploadID, parts)
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
	return client.Object.AbortMultipartUpload(ctx, bucket, key, uploadID)
}

// GenerateAccessLinks builds presigned URLs (one per method) and stores them in history.
func (s *Service) GenerateAccessLinks(ctx context.Context, accountID string, input AccessLinkRequest) ([]AccessLink, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return nil, err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return nil, err
	}
	bucket := input.Bucket
	key := input.Key
	methods := normalizeMethods(input.Methods)
	expiresIn := normalizeExpiration(input.ExpirationSeconds)
	baseHeaders := mergeResponseHeaders(input.FileName, input.ResponseHeaders)
	label := input.FileName
	if strings.TrimSpace(label) == "" {
		label = filepath.Base(key)
	}
	results := make([]AccessLink, 0, len(methods))
	for _, method := range methods {
		req := storage.PresignRequest{
			Bucket:          bucket,
			Key:             key,
			Method:          method,
			Expiration:      expiresIn,
			VersionID:       input.VersionID,
			ResponseHeaders: baseHeaders,
		}
		url, err := client.Object.PresignURL(ctx, req)
		if err != nil {
			return nil, err
		}
		qr, err := qrDataURI(url)
		if err != nil {
			return nil, err
		}

		expiresAt := time.Now().Add(expiresIn)
		results = append(results, AccessLink{
			ID:              uuid.NewString(), // Generate ID since history entry is gone
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

func (s *Service) client(ctx context.Context, accountID string) (*storage.Client, error) {
	return s.accounts.GetClient(ctx, s.vault, accountID)
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

func cloneObjectDescriptors(items []storage.ObjectDescriptor) []storage.ObjectDescriptor {
	if len(items) == 0 {
		return nil
	}
	out := make([]storage.ObjectDescriptor, 0, len(items))
	for _, item := range items {
		out = append(out, cloneObjectDescriptor(item))
	}
	return out
}

func cloneObjectDescriptor(desc storage.ObjectDescriptor) storage.ObjectDescriptor {
	return storage.ObjectDescriptor{
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

func cloneObjectACL(acl storage.ObjectACL) *storage.ObjectACL {
	copied := &storage.ObjectACL{
		Canned:           acl.Canned,
		OwnerID:          acl.OwnerID,
		OwnerDisplayName: acl.OwnerDisplayName,
	}
	if len(acl.Grants) > 0 {
		copied.Grants = make([]storage.AccessGrant, 0, len(acl.Grants))
		for _, grant := range acl.Grants {
			copied.Grants = append(copied.Grants, grant)
		}
	}
	return copied
}

func applyObjectPatch(ctx context.Context, driver storage.ObjectAdapter, patch ObjectAttributesPatch) error {
	bucket := strings.TrimSpace(patch.Bucket)
	key := strings.TrimSpace(patch.Key)
	if bucket == "" || key == "" {
		return errors.New("bucket and key are required")
	}
	var unsupported []string
	applied := false
	if patch.Metadata != nil || patch.ContentType != "" || patch.StorageClass != "" {
		update := storage.ObjectMetadataUpdate{
			Metadata:     patch.Metadata,
			ContentType:  patch.ContentType,
			StorageClass: patch.StorageClass,
		}
		if err := driver.UpdateObjectMetadata(ctx, bucket, key, update); err != nil {
			if errors.Is(err, storage.ErrUnsupportedFeature) {
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
			if errors.Is(err, storage.ErrUnsupportedFeature) {
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
			if errors.Is(err, storage.ErrUnsupportedFeature) {
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
