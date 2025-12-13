package api

import "time"

// BucketEncryptionConfiguration represents server-side encryption configuration.
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

// BucketVersioningStatus represents the versioning state of a bucket.
type BucketVersioningStatus string

const (
	VersioningStatusEnabled   BucketVersioningStatus = "Enabled"
	VersioningStatusSuspended BucketVersioningStatus = "Suspended"
)

type BucketVersioningConfiguration struct {
	Status    BucketVersioningStatus
	MFADelete string // Optional
}

// LifecycleRule represents a lifecycle management rule.
type LifecycleRule struct {
	ID                             string
	Prefix                         string // Deprecated in favor of Filter but widely used
	Status                         string // "Enabled" or "Disabled"
	Expiration                     *LifecycleExpiration
	Transitions                    []LifecycleTransition
	NoncurrentVersionExpiration    *NoncurrentVersionExpiration
	Filter                         *LifecycleFilter // For newer rules that use Filter instead of Prefix
	AbortIncompleteMultipartUpload *AbortIncompleteMultipartUpload
}

type LifecycleExpiration struct {
	Date                      *time.Time // Use time.Time? No, let's use standard types
	Days                      *int32
	ExpiredObjectDeleteMarker bool
}

type LifecycleTransition struct {
	Date         *time.Time
	Days         *int32
	StorageClass string
}

type NoncurrentVersionExpiration struct {
	NoncurrentDays *int32
}

type LifecycleFilter struct {
	Prefix string
	// Tag, And, etc. omitted for now as config package seems to use Prefix
}

type AbortIncompleteMultipartUpload struct {
	DaysAfterInitiation *int32
}

// CORSRule represents a Cross-Origin Resource Sharing rule.
type CORSRule struct {
	ID             string
	AllowedHeaders []string
	AllowedMethods []string
	AllowedOrigins []string
	ExposeHeaders  []string
	MaxAgeSeconds  int32
}

// BucketWebsiteConfiguration represents website configuration.
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
