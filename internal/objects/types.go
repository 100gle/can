package objects

import "time"

// MutationOptions carries idempotency and origin metadata for stateful object operations.
type MutationOptions struct {
	RequestID string `json:"requestId"`
	Origin    string `json:"origin"`
}

// ObjectInfo describes a file or pseudo-folder inside a bucket.
type ObjectInfo struct {
	Key           string            `json:"key"`
	Size          int64             `json:"size"`
	LastModified  time.Time         `json:"lastModified" ts_type:"string"`
	ETag          string            `json:"etag"`
	ContentType   string            `json:"contentType"`
	StorageClass  string            `json:"storageClass"`
	VersionID     string            `json:"versionId"`
	IsDir         bool              `json:"isDir"`
	Metadata      map[string]string `json:"metadata"`
	IsSymlink     bool              `json:"isSymlink"`
	SymlinkTarget string            `json:"symlinkTarget"`
}

// ListObjectsInput specifies the listing boundaries.
type ListObjectsInput struct {
	Bucket    string `json:"bucket" validate:"required,bucket-name"`
	Prefix    string `json:"prefix"`
	Delimiter string `json:"delimiter"`
	Limit     int    `json:"limit"`
	Marker    string `json:"marker"`
}

// ListObjectsResult carries the page of objects and pagination state.
type ListObjectsResult struct {
	Objects    []ObjectInfo `json:"objects"`
	NextMarker string       `json:"nextMarker"`
	Truncated  bool         `json:"truncated"`
}

// MoveObjectRequest represents a single move/copy+delete operation.
type MoveObjectRequest struct {
	SourceBucket string `json:"sourceBucket" validate:"required,bucket-name"`
	SourceKey    string `json:"sourceKey" validate:"required,object-key"`
	TargetBucket string `json:"targetBucket" validate:"required,bucket-name"`
	TargetKey    string `json:"targetKey" validate:"required,object-key"`
}

// BatchOperationFailure captures best-effort errors for batch work.
type BatchOperationFailure struct {
	Bucket string `json:"bucket"`
	Key    string `json:"key"`
	Error  string `json:"error"`
}

// MoveObjectsResult summarises a batch move invocation.
type MoveObjectsResult struct {
	Total     int                     `json:"total"`
	Succeeded int                     `json:"succeeded"`
	Failed    []BatchOperationFailure `json:"failed"`
}

// ObjectAttributes aggregates metadata, tags and ACL for a key.
type ObjectAttributes struct {
	Object    ObjectInfo        `json:"object"`
	Metadata  map[string]string `json:"metadata"`
	Tags      map[string]string `json:"tags"`
	ACL       string            `json:"acl"`
	Grants    []AccessGrant     `json:"grants"`
	OwnerID   string            `json:"ownerId"`
	OwnerName string            `json:"ownerName"`
}

// AccessGrant mirrors provider ACL grants for UI display.
type AccessGrant struct {
	GranteeType string `json:"granteeType"`
	Grantee     string `json:"grantee"`
	Permission  string `json:"permission"`
}

// ObjectAttributesPatch defines a partial update for metadata/tags/ACL.
type ObjectAttributesPatch struct {
	Bucket       string            `json:"bucket" validate:"required,bucket-name"`
	Key          string            `json:"key" validate:"required,object-key"`
	Metadata     map[string]string `json:"metadata"`
	Tags         map[string]string `json:"tags"`
	ContentType  string            `json:"contentType"`
	StorageClass string            `json:"storageClass"`
	ACL          string            `json:"acl"`
}

// BatchAttributesResult summarises batch attribute updates.
type BatchAttributesResult struct {
	Total     int                     `json:"total"`
	Succeeded int                     `json:"succeeded"`
	Failed    []BatchOperationFailure `json:"failed"`
}

// BatchDeleteResult summarises batch delete operations.
type BatchDeleteResult struct {
	Total     int                     `json:"total"`
	Succeeded int                     `json:"succeeded"`
	Failed    []BatchOperationFailure `json:"failed"`
}

// ObjectLockConfiguration summarises the bucket-level object lock defaults.
type ObjectLockConfiguration struct {
	Enabled        bool   `json:"enabled"`
	Mode           string `json:"mode"`
	RetentionDays  int32  `json:"retentionDays"`
	RetentionYears int32  `json:"retentionYears"`
}

// ObjectRetentionState captures retention metadata of a specific object/version.
type ObjectRetentionState struct {
	Mode        string    `json:"mode"`
	RetainUntil time.Time `json:"retainUntil" ts_type:"string"`
}

// UpdateObjectRetentionInput controls retention mutations for an object/version.
type UpdateObjectRetentionInput struct {
	Bucket           string    `json:"bucket" validate:"required,bucket-name"`
	Key              string    `json:"key" validate:"required,object-key"`
	VersionID        string    `json:"versionId"`
	Mode             string    `json:"mode" validate:"required,oneof=GOVERNANCE COMPLIANCE"`
	RetainUntil      time.Time `json:"retainUntil" ts_type:"string" validate:"required"`
	BypassGovernance bool      `json:"bypassGovernance"`
}

// ObjectLegalHoldState reflects the current legal hold flag.
type ObjectLegalHoldState struct {
	Status string `json:"status"`
}

// UpdateObjectLegalHoldInput toggles legal hold status.
type UpdateObjectLegalHoldInput struct {
	Bucket    string `json:"bucket" validate:"required,bucket-name"`
	Key       string `json:"key" validate:"required,object-key"`
	VersionID string `json:"versionId"`
	Status    string `json:"status" validate:"required,oneof=ON OFF"`
}

// DownloadObjectInput describes advanced download preferences for a single object.
type DownloadObjectInput struct {
	Bucket           string `json:"bucket" validate:"required,bucket-name"`
	Key              string `json:"key" validate:"required,object-key"`
	SavePath         string `json:"savePath" validate:"required"`
	TargetDirectory  string `json:"targetDirectory"`
	ConflictStrategy string `json:"conflictStrategy"`
	DisableResume    bool   `json:"disableResume"`
	VersionID        string `json:"versionId"`
	ExpectedETag     string `json:"expectedEtag"`
}

// DownloadBatchInput bundles multiple objects into a single archive download.
type DownloadBatchInput struct {
	Bucket           string               `json:"bucket"`
	Entries          []DownloadBatchEntry `json:"entries"`
	TargetDirectory  string               `json:"targetDirectory"`
	ArchiveName      string               `json:"archiveName"`
	ConflictStrategy string               `json:"conflictStrategy"`
}

// DownloadBatchEntry represents a single source object when building an archive.
type DownloadBatchEntry struct {
	Bucket       string `json:"bucket"`
	Key          string `json:"key"`
	RelativePath string `json:"relativePath"`
	Size         int64  `json:"size"`
	VersionID    string `json:"versionId"`
	IsDir        bool   `json:"isDir"`
}

// AccessLinkRequest controls presigned URL generation.
type AccessLinkRequest struct {
	Bucket            string            `json:"bucket" validate:"required,bucket-name"`
	Key               string            `json:"key" validate:"required,object-key"`
	Methods           []string          `json:"methods" validate:"required,min=1"`
	ExpirationSeconds int64             `json:"expirationSeconds" validate:"required,min=1"`
	ResponseHeaders   map[string]string `json:"responseHeaders"`
	FileName          string            `json:"fileName"`
	VersionID         string            `json:"versionId"`
}

// AccessLink describes a generated presigned URL plus helper representations.
type AccessLink struct {
	ID              string            `json:"id"`
	Method          string            `json:"method"`
	URL             string            `json:"url"`
	ExpiresAt       time.Time         `json:"expiresAt" ts_type:"string"`
	Markdown        string            `json:"markdown"`
	HTML            string            `json:"html"`
	QRCode          string            `json:"qrCode"`
	ResponseHeaders map[string]string `json:"responseHeaders"`
}
