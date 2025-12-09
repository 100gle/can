package providers

import (
	"context"
	"io"
	"time"

	"can/internal/types"
)

// BucketDescriptor represents a bucket summary independent of provider.
type BucketDescriptor struct {
	Name        string    `json:"name"`
	CreatedAt   time.Time `json:"createdAt" ts_type:"string"`
	Region      string    `json:"region"`
	ObjectCount int64     `json:"objectCount"`
	Size        int64     `json:"size"`
}

// BucketCreateInput captures options supported during bucket creation.
type BucketCreateInput struct {
	Name         string
	Region       string
	ACL          string
	StorageClass string
	COSMultiAZ   bool
}

// ObjectDescriptor represents either a file or pseudo-folder.
type ObjectDescriptor struct {
	Key           string            `json:"key"`
	Size          int64             `json:"size"`
	LastModified  time.Time         `json:"lastModified" ts_type:"string"`
	ETag          string            `json:"etag"`
	ContentType   string            `json:"contentType"`
	StorageClass  string            `json:"storageClass"`
	IsDir         bool              `json:"isDir"`
	Metadata      map[string]string `json:"metadata"`
	VersionID     string            `json:"versionId"`
	IsSymlink     bool              `json:"isSymlink"`
	SymlinkTarget string            `json:"symlinkTarget"`
}

// ListObjectsInput mirrors the UI filtering options.
type ListObjectsInput struct {
	Bucket    string `json:"bucket"`
	Prefix    string `json:"prefix"`
	Delimiter string `json:"delimiter"`
	Limit     int    `json:"limit"`
	Marker    string `json:"marker"`
}

// ListObjectsResult contains a page of objects and pagination cursor.
type ListObjectsResult struct {
	Objects    []ObjectDescriptor `json:"objects"`
	NextMarker string             `json:"nextMarker"`
	Truncated  bool               `json:"truncated"`
}

// ObjectDownload wraps the streaming payload and selected metadata.
type ObjectDownload struct {
	Body          io.ReadCloser
	ContentType   string
	ContentLength int64
	ETag          string
}

// DownloadObjectInput describes a ranged/object-version download request.
type DownloadObjectInput struct {
	Bucket     string
	Key        string
	VersionID  string
	RangeStart *int64
	RangeEnd   *int64
}

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

// DeleteObjectsResult summarises a batch delete operation.
type DeleteObjectsResult struct {
	Deleted []string            `json:"deleted"`
	Errors  []DeleteObjectError `json:"errors"`
}

// DeleteObjectError represents a single failed deletion in a batch.
type DeleteObjectError struct {
	Key     string `json:"key"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

// ObjectMetadataUpdate describes metadata/content type/storage class changes.
type ObjectMetadataUpdate struct {
	Metadata     map[string]string
	ContentType  string
	StorageClass string
}

// ObjectACL captures the simplified ACL state of an object.
type ObjectACL struct {
	Canned           string        `json:"canned"`
	OwnerID          string        `json:"ownerId"`
	OwnerDisplayName string        `json:"ownerDisplayName"`
	Grants           []AccessGrant `json:"grants"`
}

// AccessGrant represents a single ACL grant entry.
type AccessGrant struct {
	GranteeType string `json:"granteeType"`
	Grantee     string `json:"grantee"`
	Permission  string `json:"permission"`
	DisplayName string `json:"displayName,omitempty"`
	URI         string `json:"uri,omitempty"`
}

// BucketACL summarises grants for a bucket.
type BucketACL struct {
	OwnerID          string        `json:"ownerId"`
	OwnerDisplayName string        `json:"ownerDisplayName"`
	Canned           string        `json:"canned"`
	Grants           []AccessGrant `json:"grants"`
}

// BucketACLInput is used when updating ACL configuration.
type BucketACLInput struct {
	OwnerID string
	Canned  string
	Grants  []AccessGrant
}

// PublicAccessBlock describes the four S3 block switches.
type PublicAccessBlock struct {
	BlockPublicAcls       bool `json:"blockPublicAcls"`
	IgnorePublicAcls      bool `json:"ignorePublicAcls"`
	BlockPublicPolicy     bool `json:"blockPublicPolicy"`
	RestrictPublicBuckets bool `json:"restrictPublicBuckets"`
}

// BucketReferer represents a Referer whitelist configuration.
type BucketReferer struct {
	Enabled    bool     `json:"enabled"`
	AllowEmpty bool     `json:"allowEmpty"`
	Whitelist  []string `json:"whitelist"`
	Mode       string   `json:"mode"`
}

// ObjectLockConfiguration represents bucket-level object lock defaults.
type ObjectLockConfiguration struct {
	Enabled        bool   `json:"enabled"`
	Mode           string `json:"mode"`
	RetentionDays  int32  `json:"retentionDays"`
	RetentionYears int32  `json:"retentionYears"`
}

// ObjectRetentionState reflects per-object retention metadata.
type ObjectRetentionState struct {
	Mode        string    `json:"mode"`
	RetainUntil time.Time `json:"retainUntil" ts_type:"string"`
}

// PutObjectRetentionInput configures retention for an object or version.
type PutObjectRetentionInput struct {
	Bucket           string
	Key              string
	VersionID        string
	Mode             string
	RetainUntil      time.Time
	BypassGovernance bool
}

// ObjectLegalHoldState represents current legal hold status.
type ObjectLegalHoldState struct {
	Status string `json:"status"`
}

// PutObjectLegalHoldInput toggles legal hold for an object or version.
type PutObjectLegalHoldInput struct {
	Bucket    string
	Key       string
	VersionID string
	Status    string
}

// PresignRequest captures the knobs for building a pre-signed URL.
type PresignRequest struct {
	Bucket          string
	Key             string
	Method          string
	Expiration      time.Duration
	VersionID       string
	ResponseHeaders map[string]string
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
