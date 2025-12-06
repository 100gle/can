package app

import (
	"can/internal/objects"
	"can/internal/transfer"
)

// ListObjects enumerates objects under the given prefix.
func (a *App) ListObjects(accountID string, input objects.ListObjectsInput) (objects.ListObjectsResult, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.ListObjects(ctx, accountID, input)
}

// UploadObject uploads a local file to the target bucket.
func (a *App) UploadObject(accountID, bucket, key, filePath string) (*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UploadObject(ctx, accountID, bucket, key, filePath)
}

// DownloadObject downloads an object to the provided path.
func (a *App) DownloadObject(accountID, bucket, key, savePath string) (*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DownloadObject(ctx, accountID, bucket, key, savePath)
}

// DownloadObjectWithOptions exposes advanced download controls to the UI.
func (a *App) DownloadObjectWithOptions(accountID string, input objects.DownloadObjectInput) (*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DownloadObjectWithOptions(ctx, accountID, input)
}

// DownloadBatch bundles multiple objects into an archive download.
func (a *App) DownloadBatch(accountID string, input objects.DownloadBatchInput) (*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DownloadBatch(ctx, accountID, input)
}

// DeleteObject removes an object from the bucket.
func (a *App) DeleteObject(accountID, bucket, key string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DeleteObject(ctx, accountID, bucket, key)
}

// CopyObject duplicates an object to a new location.
func (a *App) CopyObject(accountID, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CopyObject(ctx, accountID, sourceBucket, sourceKey, targetBucket, targetKey)
}

// RenameObject renames an object inside the same bucket.
func (a *App) RenameObject(accountID, bucket, oldKey, newKey string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.RenameObject(ctx, accountID, bucket, oldKey, newKey)
}

// MoveObjects performs batch move operations (copy + delete).
func (a *App) MoveObjects(accountID string, requests []objects.MoveObjectRequest) (objects.MoveObjectsResult, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.MoveObjects(ctx, accountID, requests)
}

// CreateFolder materialises a pseudo-folder marker object.
func (a *App) CreateFolder(accountID, bucket, prefix string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CreateFolder(ctx, accountID, bucket, prefix)
}

// HeadObject fetches metadata for a specific key.
func (a *App) HeadObject(accountID, bucket, key string) (objects.ObjectInfo, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.HeadObject(ctx, accountID, bucket, key)
}

// GetObjectAttributes returns metadata, tags and ACL information.
func (a *App) GetObjectAttributes(accountID, bucket, key string) (objects.ObjectAttributes, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetObjectAttributes(ctx, accountID, bucket, key)
}

// UpdateObjectAttributes applies attribute changes and returns the updated state.
func (a *App) UpdateObjectAttributes(accountID string, patch objects.ObjectAttributesPatch) (objects.ObjectAttributes, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UpdateObjectAttributes(ctx, accountID, patch)
}

// BatchUpdateObjectAttributes best-effort applies patches to multiple objects.
func (a *App) BatchUpdateObjectAttributes(accountID string, patches []objects.ObjectAttributesPatch) (objects.BatchAttributesResult, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.BatchUpdateObjectAttributes(ctx, accountID, patches)
}

// GetPresignedDownloadURL returns a GET URL valid for the requested duration in minutes.
func (a *App) GetPresignedDownloadURL(accountID, bucket, key string, expirationMinutes int64) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetPresignedURL(ctx, accountID, bucket, key, expirationMinutes*60, "GET")
}

// GetPresignedUploadURL returns a PUT URL for direct uploads.
func (a *App) GetPresignedUploadURL(accountID, bucket, key string, expirationMinutes int64) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetPresignedURL(ctx, accountID, bucket, key, expirationMinutes*60, "PUT")
}

// InitiateMultipartUpload creates a multipart upload session.
func (a *App) InitiateMultipartUpload(accountID, bucket, key string) (string, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.InitiateMultipartUpload(ctx, accountID, bucket, key)
}

// UploadPart uploads a single chunk to an existing multipart session.
func (a *App) UploadPart(accountID, bucket, key, uploadID string, partNumber int, data []byte) (string, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UploadPart(ctx, accountID, bucket, key, uploadID, partNumber, data)
}

// CompleteMultipartUpload finalises all parts for a key.
func (a *App) CompleteMultipartUpload(accountID, bucket, key, uploadID string, parts map[int]string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CompleteMultipartUpload(ctx, accountID, bucket, key, uploadID, parts)
}

// AbortMultipartUpload cancels an in-flight multipart upload.
func (a *App) AbortMultipartUpload(accountID, bucket, key, uploadID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.AbortMultipartUpload(ctx, accountID, bucket, key, uploadID)
}

// GenerateAccessLinks returns presigned URLs plus helper metadata.
func (a *App) GenerateAccessLinks(accountID string, input objects.AccessLinkRequest) ([]objects.AccessLink, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GenerateAccessLinks(ctx, accountID, input)
}

// ListAccessLinkHistory returns stored presigned link history for an account.
func (a *App) ListAccessLinkHistory(accountID string, limit int) ([]objects.LinkHistoryEntry, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.ListAccessLinkHistory(ctx, accountID, limit)
}

// DeleteAccessLinkHistory removes a single history item.
func (a *App) DeleteAccessLinkHistory(accountID, linkID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DeleteAccessLinkHistory(ctx, accountID, linkID)
}
