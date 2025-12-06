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

// HeadObject fetches metadata for a specific key.
func (a *App) HeadObject(accountID, bucket, key string) (objects.ObjectInfo, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.HeadObject(ctx, accountID, bucket, key)
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
