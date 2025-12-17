package storage

import (
	"io"
	"time"
)

type BucketDescriptor struct {
	Name        string    `json:"name"`
	CreatedAt   time.Time `json:"createdAt" ts_type:"string"`
	Region      string    `json:"region"`
	ObjectCount int64     `json:"objectCount"`
	Size        int64     `json:"size"`
}

type BucketCreateInput struct {
	Name         string `json:"name" validate:"required,bucket-name"`
	Region       string `json:"region"`
	ACL          string `json:"acl"`
	StorageClass string `json:"storageClass"`
	COSMultiAZ   bool   `json:"cosMultiAz"`
}

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

type ListObjectsInput struct {
	Bucket    string `json:"bucket" validate:"required,bucket-name"`
	Region    string `json:"region"` // Optional: Optimization for OSS/multi-region
	Prefix    string `json:"prefix"`
	Delimiter string `json:"delimiter"`
	Limit     int    `json:"limit" validate:"min=0"`
	Marker    string `json:"marker"`
}

type ListObjectsResult struct {
	Objects    []ObjectDescriptor `json:"objects"`
	NextMarker string             `json:"nextMarker"`
	Truncated  bool               `json:"truncated"`
}

type ObjectDownload struct {
	Body          io.ReadCloser
	ContentType   string
	ContentLength int64
	ETag          string
}

type DownloadObjectInput struct {
	Bucket     string
	Key        string
	VersionID  string
	RangeStart *int64
	RangeEnd   *int64
}

type DeleteObjectsResult struct {
	Deleted []string            `json:"deleted"`
	Errors  []DeleteObjectError `json:"errors"`
}

type DeleteObjectError struct {
	Key     string `json:"key"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ObjectMetadataUpdate struct {
	Metadata     map[string]string
	ContentType  string
	StorageClass string
}

type ObjectACL struct {
	Canned           string        `json:"canned"`
	OwnerID          string        `json:"ownerId"`
	OwnerDisplayName string        `json:"ownerDisplayName"`
	Grants           []AccessGrant `json:"grants"`
}

type AccessGrant struct {
	GranteeType string `json:"granteeType"`
	Grantee     string `json:"grantee"`
	Permission  string `json:"permission"`
	DisplayName string `json:"displayName,omitempty"`
	URI         string `json:"uri,omitempty"`
}

type BucketACL struct {
	OwnerID          string        `json:"ownerId"`
	OwnerDisplayName string        `json:"ownerDisplayName"`
	Canned           string        `json:"canned"`
	Grants           []AccessGrant `json:"grants"`
}

type BucketACLInput struct {
	OwnerID string
	Canned  string
	Grants  []AccessGrant
}

type PublicAccessBlock struct {
	BlockPublicAcls       bool `json:"blockPublicAcls"`
	IgnorePublicAcls      bool `json:"ignorePublicAcls"`
	BlockPublicPolicy     bool `json:"blockPublicPolicy"`
	RestrictPublicBuckets bool `json:"restrictPublicBuckets"`
}

type BucketReferer struct {
	Enabled    bool     `json:"enabled"`
	AllowEmpty bool     `json:"allowEmpty"`
	Whitelist  []string `json:"whitelist"`
	Mode       string   `json:"mode"`
}

type ObjectLockConfiguration struct {
	Enabled        bool   `json:"enabled"`
	Mode           string `json:"mode"`
	RetentionDays  int32  `json:"retentionDays"`
	RetentionYears int32  `json:"retentionYears"`
}

type ObjectRetentionState struct {
	Mode        string    `json:"mode"`
	RetainUntil time.Time `json:"retainUntil" ts_type:"string"`
}

type PutObjectRetentionInput struct {
	Bucket           string
	Key              string
	VersionID        string
	Mode             string
	RetainUntil      time.Time
	BypassGovernance bool
}

type ObjectLegalHoldState struct {
	Status string `json:"status"`
}

type PutObjectLegalHoldInput struct {
	Bucket    string
	Key       string
	VersionID string
	Status    string
}

type PresignRequest struct {
	Bucket          string
	Key             string
	Method          string
	Expiration      time.Duration
	VersionID       string
	ResponseHeaders map[string]string
}

type SecurityTokens struct {
	AccessKeyId     string    `json:"accessKeyId"`
	SecretAccessKey string    `json:"secretAccessKey"`
	SessionToken    string    `json:"sessionToken"`
	Expiration      time.Time `json:"expiration"`
}

type GenerateTokensRequest struct {
	DurationSeconds int64  `json:"durationSeconds"`
	Policy          string `json:"policy,omitempty"`
}

type MAZConfiguration struct {
	Status string `json:"status"`
}

const (
	MAZStatusEnabled  = "Enabled"
	MAZStatusDisabled = "Disabled"
)

type BucketEncryptionConfiguration struct {
	Rules []BucketEncryptionRule
}

type BucketEncryptionRule struct {
	ApplyServerSideEncryptionByDefault *ServerSideEncryptionByDefault
}

type ServerSideEncryptionByDefault struct {
	SSEAlgorithm   string
	KMSMasterKeyID string
}

type BucketVersioningStatus string

const (
	VersioningStatusEnabled   BucketVersioningStatus = "Enabled"
	VersioningStatusSuspended BucketVersioningStatus = "Suspended"
)

type BucketVersioningConfiguration struct {
	Status    BucketVersioningStatus
	MFADelete string
}

type LifecycleRule struct {
	ID                             string
	Prefix                         string
	Status                         string
	Expiration                     *LifecycleExpiration
	Transitions                    []LifecycleTransition
	NoncurrentVersionExpiration    *NoncurrentVersionExpiration
	Filter                         *LifecycleFilter
	AbortIncompleteMultipartUpload *AbortIncompleteMultipartUpload
}

type LifecycleExpiration struct {
	Date                      time.Time
	Days                      int32
	ExpiredObjectDeleteMarker bool
}

type LifecycleTransition struct {
	Date         time.Time
	Days         int32
	StorageClass string
}

type NoncurrentVersionExpiration struct {
	NoncurrentDays int32
}

type LifecycleFilter struct {
	Prefix string
}

type AbortIncompleteMultipartUpload struct {
	DaysAfterInitiation int32
}

type CORSRule struct {
	ID             string
	AllowedHeaders []string
	AllowedMethods []string
	AllowedOrigins []string
	ExposeHeaders  []string
	MaxAgeSeconds  int32
}

type BucketWebsiteConfiguration struct {
	ErrorDocument         *ErrorDocument
	IndexDocument         *IndexDocument
	RedirectAllRequestsTo *RedirectAllRequestsTo
	RoutingRules          []RoutingRule
}

type ErrorDocument struct {
	Key string
}

type IndexDocument struct {
	Suffix string
}

type RedirectAllRequestsTo struct {
	HostName string
	Protocol string
}

type RoutingRule struct {
	Condition *RoutingRuleCondition
	Redirect  *Redirect
}

type RoutingRuleCondition struct {
	HttpErrorCodeReturnedEquals string
	KeyPrefixEquals             string
}

type Redirect struct {
	HostName             string
	HttpRedirectCode     string
	Protocol             string
	ReplaceKeyPrefixWith string
	ReplaceKeyWith       string
}
