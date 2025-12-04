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
	CreatedAt   time.Time `json:"createdAt"`
	Region      string    `json:"region"`
	ObjectCount int64     `json:"objectCount"`
	Size        int64     `json:"size"`
}

// ObjectDescriptor represents either a file or pseudo-folder.
type ObjectDescriptor struct {
	Key          string    `json:"key"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"lastModified"`
	ETag         string    `json:"etag"`
	ContentType  string    `json:"contentType"`
	IsDir        bool      `json:"isDir"`
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
	DownloadObject(ctx context.Context, bucket, key string) (ObjectDownload, error)
	DeleteObject(ctx context.Context, bucket, key string) error
	CopyObject(ctx context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error
	HeadObject(ctx context.Context, bucket, key string) (ObjectDescriptor, error)
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
