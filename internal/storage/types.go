package storage

import (
	"io"
	"time"

	"can/internal/types"
)

// ConnectionCredentials contains the necessary data to interact with a provider API.
type ConnectionCredentials struct {
	Provider        types.Provider `json:"provider"`
	Endpoint        string         `json:"endpoint"`
	AccessKeyID     string         `json:"accessKeyId"`
	SecretAccessKey string         `json:"secretAccessKey"`
	Region          string         `json:"region"`
	UseSSL          bool           `json:"useSSL"`
	Port            int            `json:"port"`
}

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

// SecurityTokens represents the temporary credentials response.
type SecurityTokens struct {
	AccessKeyId     string    `json:"accessKeyId"`
	SecretAccessKey string    `json:"secretAccessKey"`
	SessionToken    string    `json:"sessionToken"`
	Expiration      time.Time `json:"expiration"`
}

// GenerateTokensRequest captures parameters for STS generation.
type GenerateTokensRequest struct {
	DurationSeconds int64  `json:"durationSeconds"`
	Policy          string `json:"policy,omitempty"` // Optional JSON policy
}

// MAZConfiguration represents Multi-AZ configuration for a bucket.
type MAZConfiguration struct {
	Status string `json:"status"`
}

const (
	MAZStatusEnabled  = "Enabled"
	MAZStatusDisabled = "Disabled"
)
