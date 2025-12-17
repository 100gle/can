package app

import (
	"encoding/base64"
	"fmt"

	"can/internal/objects"
	"can/internal/storage"
	"can/internal/transfer"
	"can/internal/validation"
)

// ListObjects enumerates objects under the given prefix.
func (a *App) ListObjects(accountID string, input storage.ListObjectsInput) (storage.ListObjectsResult, error) {
	if err := validation.ValidateStruct(input); err != nil {
		return storage.ListObjectsResult{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.ListObjects(ctx, accountID, input)
}

// UploadObject uploads a local file to the target bucket.
func (a *App) UploadObject(accountID, bucket, key, filePath string) (*transfer.TransferTask, error) {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return nil, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UploadObject(ctx, accountID, input.Bucket, input.Key, filePath)
}

// DownloadObject downloads an object to the provided path.
func (a *App) DownloadObject(accountID, bucket, key, savePath string) (*transfer.TransferTask, error) {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return nil, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DownloadObject(ctx, accountID, input.Bucket, input.Key, savePath)
}

// DownloadObjectWithOptions exposes advanced download controls to the UI.
func (a *App) DownloadObjectWithOptions(accountID string, input objects.DownloadObjectInput) (*transfer.TransferTask, error) {
	if err := validation.ValidateStruct(input); err != nil {
		return nil, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DownloadObjectWithOptions(ctx, accountID, input)
}

// DownloadBatch bundles multiple objects into an archive download.
func (a *App) DownloadBatch(accountID string, input objects.DownloadBatchInput) (*transfer.TransferTask, error) {
	if err := validation.ValidateStruct(input); err != nil {
		return nil, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DownloadBatch(ctx, accountID, input)
}

// DeleteObject removes an object from the bucket.
func (a *App) DeleteObject(accountID, bucket, key string) error {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DeleteObject(ctx, accountID, input)
}

// DeleteObjectWithOptions removes an object with mutation tracking metadata.
func (a *App) DeleteObjectWithOptions(accountID, bucket, key string, opts objects.MutationOptions) error {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DeleteObjectWithOptions(ctx, accountID, input, opts)
}

// BatchDeleteObjects removes multiple objects from the bucket.
func (a *App) BatchDeleteObjects(accountID, bucket string, keys []string) (objects.BatchDeleteResult, error) {
	input := objects.BatchDeleteObjectsInput{Bucket: bucket, Keys: keys}
	if err := validation.ValidateStruct(input); err != nil {
		return objects.BatchDeleteResult{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.BatchDeleteObjects(ctx, accountID, input)
}

// CopyObject duplicates an object to a new location.
func (a *App) CopyObject(accountID, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	input := objects.CopyObjectInput{
		SourceBucket: sourceBucket,
		SourceKey:    sourceKey,
		TargetBucket: targetBucket,
		TargetKey:    targetKey,
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CopyObject(ctx, accountID, input)
}

// RenameObject renames an object inside the same bucket.
func (a *App) RenameObject(accountID, bucket, oldKey, newKey string) error {
	input := objects.RenameObjectInput{
		Bucket: bucket,
		OldKey: oldKey,
		NewKey: newKey,
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.RenameObject(ctx, accountID, input)
}

// RenameObjectWithOptions renames an object with mutation tracking metadata.
func (a *App) RenameObjectWithOptions(accountID, bucket, oldKey, newKey string, opts objects.MutationOptions) error {
	input := objects.RenameObjectInput{
		Bucket: bucket,
		OldKey: oldKey,
		NewKey: newKey,
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.RenameObjectWithOptions(ctx, accountID, input, opts)
}

// MoveObjects performs batch move operations (copy + delete).
func (a *App) MoveObjects(accountID string, requests []objects.MoveObjectRequest) (objects.MoveObjectsResult, error) {
	input := objects.MoveObjectsInput{Requests: requests}
	if err := validation.ValidateStruct(input); err != nil {
		return objects.MoveObjectsResult{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.MoveObjects(ctx, accountID, input)
}

// MoveObjectsWithOptions performs batch move operations with mutation tracking.
func (a *App) MoveObjectsWithOptions(accountID string, requests []objects.MoveObjectRequest, opts objects.MutationOptions) (objects.MoveObjectsResult, error) {
	input := objects.MoveObjectsInput{Requests: requests}
	if err := validation.ValidateStruct(input); err != nil {
		return objects.MoveObjectsResult{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.MoveObjectsWithOptions(ctx, accountID, input, opts)
}

// CreateFolder materialises a pseudo-folder marker object.
func (a *App) CreateFolder(accountID, bucket, prefix string) error {
	input := objects.CreateFolderInput{Bucket: bucket, Prefix: prefix}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CreateFolder(ctx, accountID, input)
}

// HeadObject fetches metadata for a specific key.
func (a *App) HeadObject(accountID, bucket, key string) (storage.ObjectDescriptor, error) {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return storage.ObjectDescriptor{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.HeadObject(ctx, accountID, input.Bucket, input.Key)
}

// GetObjectAttributes returns metadata, tags and ACL information.
func (a *App) GetObjectAttributes(accountID, bucket, key string) (objects.ObjectAttributes, error) {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return objects.ObjectAttributes{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetObjectAttributes(ctx, accountID, input.Bucket, input.Key)
}

// UpdateObjectAttributes applies attribute changes and returns the updated state.
func (a *App) UpdateObjectAttributes(accountID string, patch objects.ObjectAttributesPatch) (objects.ObjectAttributes, error) {
	if err := validation.ValidateStruct(patch); err != nil {
		return objects.ObjectAttributes{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UpdateObjectAttributes(ctx, accountID, patch)
}

// BatchUpdateObjectAttributes best-effort applies patches to multiple objects.
func (a *App) BatchUpdateObjectAttributes(accountID string, patches []objects.ObjectAttributesPatch) (objects.BatchAttributesResult, error) {
	payload := struct {
		Patches []objects.ObjectAttributesPatch `validate:"required,min=1,dive"`
	}{Patches: patches}
	if err := validation.ValidateStruct(payload); err != nil {
		return objects.BatchAttributesResult{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.BatchUpdateObjectAttributes(ctx, accountID, payload.Patches)
}

// GetPresignedDownloadURL returns a GET URL valid for the requested duration in minutes.
func (a *App) GetPresignedDownloadURL(accountID, bucket, key string, expirationMinutes int64) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return "", err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetPresignedURL(ctx, accountID, input.Bucket, input.Key, expirationMinutes*60, "GET")
}

// GetPresignedDownloadURLWithHeaders returns a GET URL customised with response headers.
func (a *App) GetPresignedDownloadURLWithHeaders(accountID, bucket, key string, expirationMinutes int64, headers map[string]string) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return "", err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetPresignedURLWithHeaders(ctx, accountID, input.Bucket, input.Key, expirationMinutes*60, "GET", headers)
}

// GetPresignedUploadURL returns a PUT URL for direct uploads.
func (a *App) GetPresignedUploadURL(accountID, bucket, key string, expirationMinutes int64) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return "", err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetPresignedURL(ctx, accountID, input.Bucket, input.Key, expirationMinutes*60, "PUT")
}

// InitiateMultipartUpload creates a multipart upload session.
func (a *App) InitiateMultipartUpload(accountID, bucket, key string) (string, error) {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return "", err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.InitiateMultipartUpload(ctx, accountID, input.Bucket, input.Key)
}

// UploadPart uploads a single chunk to an existing multipart session.
func (a *App) UploadPart(accountID, bucket, key, uploadID string, partNumber int, dataBase64 string) (string, error) {
	input := multipartUploadPartInput{
		Bucket:     bucket,
		Key:        key,
		UploadID:   uploadID,
		PartNumber: partNumber,
	}
	if err := validation.ValidateStruct(input); err != nil {
		return "", err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()

	// Decode base64 to []byte
	data, err := base64.StdEncoding.DecodeString(dataBase64)
	if err != nil {
		return "", fmt.Errorf("failed to decode upload data: %w", err)
	}

	return a.objects.UploadPart(ctx, accountID, input.Bucket, input.Key, input.UploadID, partNumber, data)
}

// CompleteMultipartUpload finalises all parts for a key.
func (a *App) CompleteMultipartUpload(accountID, bucket, key, uploadID string, parts map[int]string) error {
	input := multipartCompleteInput{
		Bucket:   bucket,
		Key:      key,
		UploadID: uploadID,
		Parts:    parts,
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CompleteMultipartUpload(ctx, accountID, input.Bucket, input.Key, input.UploadID, parts)
}

// AbortMultipartUpload cancels an in-flight multipart upload.
func (a *App) AbortMultipartUpload(accountID, bucket, key, uploadID string) error {
	input := multipartAbortInput{
		Bucket:   bucket,
		Key:      key,
		UploadID: uploadID,
	}
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.AbortMultipartUpload(ctx, accountID, input.Bucket, input.Key, input.UploadID)
}

// GenerateAccessLinks returns presigned URLs plus helper metadata.
func (a *App) GenerateAccessLinks(accountID string, input objects.AccessLinkRequest) ([]objects.AccessLink, error) {
	if err := validation.ValidateStruct(input); err != nil {
		return nil, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GenerateAccessLinks(ctx, accountID, input)
}

// CreateSymlink creates an OSS soft link pointing to another key.
func (a *App) CreateSymlink(accountID, bucket, linkKey, targetKey string) error {
	payload := symlinkCreateInput{Bucket: bucket, LinkKey: linkKey, TargetKey: targetKey}
	if err := validation.ValidateStruct(payload); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CreateSymlink(ctx, accountID, payload.Bucket, payload.LinkKey, payload.TargetKey)
}

// GetSymlink returns the target of an OSS symlink.
func (a *App) GetSymlink(accountID, bucket, key string) (string, error) {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return "", err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetSymlink(ctx, accountID, input.Bucket, input.Key)
}

// GetObjectLockConfiguration fetches bucket-level object lock defaults.
func (a *App) GetObjectLockConfiguration(accountID, bucket string) (storage.ObjectLockConfiguration, error) {
	payload := bucketNameInput{Name: bucket}
	if err := validation.ValidateStruct(payload); err != nil {
		return storage.ObjectLockConfiguration{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetObjectLockConfiguration(ctx, accountID, payload.Name)
}

// GetObjectRetention returns retention metadata for the specified object/version.
func (a *App) GetObjectRetention(accountID, bucket, key, versionID string) (storage.ObjectRetentionState, error) {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return storage.ObjectRetentionState{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetObjectRetention(ctx, accountID, input.Bucket, input.Key, versionID)
}

// UpdateObjectRetention applies retention settings for an object/version.
func (a *App) UpdateObjectRetention(accountID string, input objects.UpdateObjectRetentionInput) (storage.ObjectRetentionState, error) {
	if err := validation.ValidateStruct(input); err != nil {
		return storage.ObjectRetentionState{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UpdateObjectRetention(ctx, accountID, input)
}

// GetObjectLegalHold returns the legal hold status for an object/version.
func (a *App) GetObjectLegalHold(accountID, bucket, key, versionID string) (storage.ObjectLegalHoldState, error) {
	input := objects.DeleteObjectInput{Bucket: bucket, Key: key}
	if err := validation.ValidateStruct(input); err != nil {
		return storage.ObjectLegalHoldState{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetObjectLegalHold(ctx, accountID, input.Bucket, input.Key, versionID)
}

// UpdateObjectLegalHold toggles object legal hold.
func (a *App) UpdateObjectLegalHold(accountID string, input objects.UpdateObjectLegalHoldInput) (storage.ObjectLegalHoldState, error) {
	if err := validation.ValidateStruct(input); err != nil {
		return storage.ObjectLegalHoldState{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UpdateObjectLegalHold(ctx, accountID, input)
}

type multipartUploadPartInput struct {
	Bucket     string `validate:"required,bucket-name"`
	Key        string `validate:"required,object-key"`
	UploadID   string `validate:"required"`
	PartNumber int    `validate:"gt=0"`
}

type multipartCompleteInput struct {
	Bucket   string         `validate:"required,bucket-name"`
	Key      string         `validate:"required,object-key"`
	UploadID string         `validate:"required"`
	Parts    map[int]string `validate:"required,min=1,dive,keys,gt=0,endkeys,required"`
}

type multipartAbortInput struct {
	Bucket   string `validate:"required,bucket-name"`
	Key      string `validate:"required,object-key"`
	UploadID string `validate:"required"`
}

type symlinkCreateInput struct {
	Bucket    string `validate:"required,bucket-name"`
	LinkKey   string `validate:"required,object-key"`
	TargetKey string `validate:"required,object-key"`
}
