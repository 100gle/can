package storage

import (
	"context"
	"io"

	"can/internal/types"
)

// BucketDriver exposes bucket-level operations for a provider.
type BucketDriver interface {
	ListBuckets(ctx context.Context) ([]BucketDescriptor, error)
	CreateBucket(ctx context.Context, input BucketCreateInput) error
	DeleteBucket(ctx context.Context, name string) error
	HeadBucket(ctx context.Context, name string) error
	BucketLocation(ctx context.Context, name string) (string, error)
	GetBucketACL(ctx context.Context, name string) (BucketACL, error)
	PutBucketACL(ctx context.Context, name string, acl BucketACLInput) error
	GetPublicAccessBlock(ctx context.Context, name string) (PublicAccessBlock, error)
	PutPublicAccessBlock(ctx context.Context, name string, block PublicAccessBlock) error
	GetBucketReferer(ctx context.Context, name string) (BucketReferer, error)
	PutBucketReferer(ctx context.Context, name string, referer BucketReferer) error

	// Extended configuration
	GetBucketEncryption(ctx context.Context, bucket string) (*BucketEncryptionConfiguration, error)
	PutBucketEncryption(ctx context.Context, bucket string, config BucketEncryptionConfiguration) error
	DeleteBucketEncryption(ctx context.Context, bucket string) error
	GetBucketPolicy(ctx context.Context, bucket string) (string, error)
	PutBucketPolicy(ctx context.Context, bucket, policy string) error
	DeleteBucketPolicy(ctx context.Context, bucket string) error
	GetBucketVersioning(ctx context.Context, bucket string) (BucketVersioningStatus, error)
	PutBucketVersioning(ctx context.Context, bucket string, status BucketVersioningStatus) error
	GetBucketLifecycleConfiguration(ctx context.Context, bucket string) ([]LifecycleRule, error)
	PutBucketLifecycleConfiguration(ctx context.Context, bucket string, rules []LifecycleRule) error
	DeleteBucketLifecycle(ctx context.Context, bucket string) error
	GetBucketCors(ctx context.Context, bucket string) ([]CORSRule, error)
	PutBucketCors(ctx context.Context, bucket string, rules []CORSRule) error
	DeleteBucketCors(ctx context.Context, bucket string) error
	GetBucketWebsite(ctx context.Context, bucket string) (*BucketWebsiteConfiguration, error)
	PutBucketWebsite(ctx context.Context, bucket string, config BucketWebsiteConfiguration) error
	DeleteBucketWebsite(ctx context.Context, bucket string) error
}

// ObjectDriver exposes object-level operations for a provider.
type ObjectDriver interface {
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
	GetObjectLockConfiguration(ctx context.Context, bucket string) (ObjectLockConfiguration, error)
	GetObjectRetention(ctx context.Context, bucket, key, versionID string) (ObjectRetentionState, error)
	PutObjectRetention(ctx context.Context, input PutObjectRetentionInput) error
	GetObjectLegalHold(ctx context.Context, bucket, key, versionID string) (ObjectLegalHoldState, error)
	PutObjectLegalHold(ctx context.Context, input PutObjectLegalHoldInput) error
}

// SecurityDriver exposes security/STS operations.
type SecurityDriver interface {
	GenerateTemporaryCredentials(ctx context.Context, req GenerateTokensRequest) (SecurityTokens, error)
}

// StorageClient bundles bucket/object drivers plus capability metadata.
type StorageClient interface {
	Provider() types.Provider
	Capabilities() []types.ProviderCapability
	Buckets() BucketDriver
	Objects() ObjectDriver
	Security() SecurityDriver
}

// StorageFactory resolves a storage client for the given credentials.
type StorageFactory interface {
	NewClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error)
}

// Dialer probes endpoints to validate credentials.
type Dialer interface {
	TestConnection(ctx context.Context, credentials ConnectionCredentials) error
}
