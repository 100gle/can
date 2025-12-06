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

// ObjectDescriptor represents either a file or pseudo-folder.
type ObjectDescriptor struct {
	Key          string            `json:"key"`
	Size         int64             `json:"size"`
	LastModified time.Time         `json:"lastModified" ts_type:"string"`
	ETag         string            `json:"etag"`
	ContentType  string            `json:"contentType"`
	StorageClass string            `json:"storageClass"`
	IsDir        bool              `json:"isDir"`
	Metadata     map[string]string `json:"metadata"`
	VersionID    string            `json:"versionId"`
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
	CreateBucket(ctx context.Context, name, region string) error
	DeleteBucket(ctx context.Context, name string) error
	HeadBucket(ctx context.Context, name string) error
	BucketLocation(ctx context.Context, name string) (string, error)
}

// ObjectDriver exposes object-level operations for a provider.
type ObjectDriver interface {
	ListObjects(ctx context.Context, input ListObjectsInput) (ListObjectsResult, error)
	UploadObject(ctx context.Context, bucket, key string, body io.Reader, size int64, contentType string) error
	DownloadObject(ctx context.Context, input DownloadObjectInput) (ObjectDownload, error)
	DeleteObject(ctx context.Context, bucket, key string) error
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
}

// StorageFactory resolves a storage client for the given credentials.
type StorageFactory interface {
	NewClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error)
}
