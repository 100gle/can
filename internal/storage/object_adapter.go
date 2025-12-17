package storage

import (
	"context"
	"io"
)

type ObjectAdapter interface {
	ListObjects(ctx context.Context, input ListObjectsInput) (ListObjectsResult, error)
	UploadObject(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType string) error
	DownloadObject(ctx context.Context, input DownloadObjectInput) (ObjectDownload, error)
	DeleteObject(ctx context.Context, bucket, key string) error
	DeleteObjects(ctx context.Context, bucket string, keys []string) (DeleteObjectsResult, error)
	CopyObject(ctx context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error
	HeadObject(ctx context.Context, bucket, key string) (ObjectDescriptor, error)
	PresignURL(ctx context.Context, input PresignRequest) (string, error)
	InitiateMultipartUpload(ctx context.Context, bucket, key string) (string, error)
	UploadPart(ctx context.Context, bucket, key, uploadID string, partNumber int, body io.Reader, size int64) (string, error)
	CompleteMultipartUpload(ctx context.Context, bucket, key, uploadID string, parts map[int]string) error
	AbortMultipartUpload(ctx context.Context, bucket, key, uploadID string) error
	GetObjectTags(ctx context.Context, bucket, key string) (map[string]string, error)
	PutObjectTags(ctx context.Context, bucket, key string, tags map[string]string) error
	UpdateObjectMetadata(ctx context.Context, bucket, key string, input ObjectMetadataUpdate) error
	GetObjectACL(ctx context.Context, bucket, key string) (ObjectACL, error)
	PutObjectACL(ctx context.Context, bucket, key, cannedACL string) error
	CreateSymlink(ctx context.Context, bucket, key, target string) error
	GetSymlink(ctx context.Context, bucket, key string) (string, error)
	GetObjectLockConfiguration(ctx context.Context, bucket string) (ObjectLockConfiguration, error)
	GetObjectRetention(ctx context.Context, bucket, key, versionID string) (ObjectRetentionState, error)
	PutObjectRetention(ctx context.Context, input PutObjectRetentionInput) error
	GetObjectLegalHold(ctx context.Context, bucket, key, versionID string) (ObjectLegalHoldState, error)
	PutObjectLegalHold(ctx context.Context, input PutObjectLegalHoldInput) error
}
