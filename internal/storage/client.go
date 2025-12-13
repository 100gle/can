package storage

import (
	"context"

	api "can/internal/storage/api"
	"can/internal/types"
)

// Re-export API types for callers in the storage root.
type (
	ConnectionCredentials          = api.ConnectionCredentials
	BucketDescriptor               = api.BucketDescriptor
	BucketCreateInput              = api.BucketCreateInput
	ObjectDescriptor               = api.ObjectDescriptor
	ListObjectsInput               = api.ListObjectsInput
	ListObjectsResult              = api.ListObjectsResult
	ObjectDownload                 = api.ObjectDownload
	DownloadObjectInput            = api.DownloadObjectInput
	DeleteObjectsResult            = api.DeleteObjectsResult
	DeleteObjectError              = api.DeleteObjectError
	ObjectMetadataUpdate           = api.ObjectMetadataUpdate
	ObjectACL                      = api.ObjectACL
	AccessGrant                    = api.AccessGrant
	BucketACL                      = api.BucketACL
	BucketACLInput                 = api.BucketACLInput
	PublicAccessBlock              = api.PublicAccessBlock
	BucketReferer                  = api.BucketReferer
	ObjectLockConfiguration        = api.ObjectLockConfiguration
	ObjectRetentionState           = api.ObjectRetentionState
	PutObjectRetentionInput        = api.PutObjectRetentionInput
	ObjectLegalHoldState           = api.ObjectLegalHoldState
	PutObjectLegalHoldInput        = api.PutObjectLegalHoldInput
	PresignRequest                 = api.PresignRequest
	SecurityTokens                 = api.SecurityTokens
	GenerateTokensRequest          = api.GenerateTokensRequest
	MAZConfiguration               = api.MAZConfiguration
	BucketEncryptionConfiguration  = api.BucketEncryptionConfiguration
	BucketEncryptionRule           = api.BucketEncryptionRule
	ServerSideEncryptionByDefault  = api.ServerSideEncryptionByDefault
	BucketVersioningStatus         = api.BucketVersioningStatus
	BucketVersioningConfiguration  = api.BucketVersioningConfiguration
	LifecycleRule                  = api.LifecycleRule
	LifecycleExpiration            = api.LifecycleExpiration
	LifecycleTransition            = api.LifecycleTransition
	NoncurrentVersionExpiration    = api.NoncurrentVersionExpiration
	LifecycleFilter                = api.LifecycleFilter
	AbortIncompleteMultipartUpload = api.AbortIncompleteMultipartUpload
	CORSRule                       = api.CORSRule
	BucketWebsiteConfiguration     = api.BucketWebsiteConfiguration
	ErrorDocument                  = api.ErrorDocument
	IndexDocument                  = api.IndexDocument
	RedirectAllRequestsTo          = api.RedirectAllRequestsTo
	RoutingRule                    = api.RoutingRule
	RoutingRuleCondition           = api.RoutingRuleCondition
	Redirect                       = api.Redirect
)

const (
	VersioningStatusEnabled   = api.VersioningStatusEnabled
	VersioningStatusSuspended = api.VersioningStatusSuspended
	MAZStatusEnabled          = api.MAZStatusEnabled
	MAZStatusDisabled         = api.MAZStatusDisabled
)

// BucketAPI exposes bucket-level operations for a provider.
type BucketAPI = api.BucketAPI

// ObjectAPI exposes object-level operations for a provider.
type ObjectAPI = api.ObjectAPI

// SecurityAPI exposes security/STS operations.
type SecurityAPI = api.SecurityAPI

// StorageClient bundles bucket/object drivers plus capability metadata.
type StorageClient interface {
	Provider() types.Provider
	Capabilities() []types.ProviderCapability
	Bucket() BucketAPI
	Object() ObjectAPI
	Security() SecurityAPI
}

// StorageFactory resolves a storage client for the given credentials.
type StorageFactory interface {
	NewClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error)
}

// Dialer probes endpoints to validate credentials.
type Dialer interface {
	TestConnection(ctx context.Context, credentials ConnectionCredentials) error
}

// ErrUnsupportedCapability exposes the shared unsupported error.
var ErrUnsupportedCapability = api.ErrUnsupportedCapability
