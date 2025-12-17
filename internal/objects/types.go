package objects

import (
	"time"

	"can/internal/storage"
)

// MutationOptions carries idempotency and origin metadata for stateful object operations.
type MutationOptions struct {
	RequestID string `json:"requestId"`
	Origin    string `json:"origin"`
}

// DeleteObjectInput represents a single delete request.
type DeleteObjectInput struct {
	Bucket string `json:"bucket" validate:"required,bucket-name"`
	Key    string `json:"key" validate:"required,object-key"`
}

// BatchDeleteObjectsInput batches multiple delete requests under the same bucket.
type BatchDeleteObjectsInput struct {
	Bucket string   `json:"bucket" validate:"required,bucket-name"`
	Keys   []string `json:"keys" validate:"required,min=1,dive,required,object-key"`
}

// CopyObjectInput duplicates an object between buckets/keys.
type CopyObjectInput struct {
	SourceBucket string `json:"sourceBucket" validate:"required,bucket-name"`
	SourceKey    string `json:"sourceKey" validate:"required,object-key"`
	TargetBucket string `json:"targetBucket" validate:"required,bucket-name"`
	TargetKey    string `json:"targetKey" validate:"required,object-key"`
}

// RenameObjectInput moves an object inside the same bucket.
type RenameObjectInput struct {
	Bucket string `json:"bucket" validate:"required,bucket-name"`
	OldKey string `json:"oldKey" validate:"required,object-key"`
	NewKey string `json:"newKey" validate:"required,object-key,nefield=OldKey"`
}

// MoveObjectRequest represents a single move/copy+delete operation.
type MoveObjectRequest struct {
	SourceBucket string `json:"sourceBucket" validate:"required,bucket-name"`
	SourceKey    string `json:"sourceKey" validate:"required,object-key"`
	TargetBucket string `json:"targetBucket" validate:"required,bucket-name"`
	TargetKey    string `json:"targetKey" validate:"required,object-key"`
}

// MoveObjectsInput groups multiple move requests.
type MoveObjectsInput struct {
	Requests []MoveObjectRequest `json:"requests" validate:"required,min=1,dive"`
}

// CreateFolderInput represents a pseudo-folder creation request.
type CreateFolderInput struct {
	Bucket string `json:"bucket" validate:"required,bucket-name"`
	Prefix string `json:"prefix" validate:"required"`
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
	Object   storage.ObjectDescriptor `json:"object"`
	Metadata map[string]string        `json:"metadata,omitempty"`
	Tags     map[string]string        `json:"tags,omitempty"`
	ACL      *storage.ObjectACL       `json:"acl,omitempty"`
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

// UpdateObjectRetentionInput controls retention mutations for an object/version.
type UpdateObjectRetentionInput struct {
	Bucket           string    `json:"bucket" validate:"required,bucket-name"`
	Key              string    `json:"key" validate:"required,object-key"`
	VersionID        string    `json:"versionId"`
	Mode             string    `json:"mode" validate:"required,oneof=GOVERNANCE COMPLIANCE"`
	RetainUntil      time.Time `json:"retainUntil" ts_type:"string" validate:"required"`
	BypassGovernance bool      `json:"bypassGovernance"`
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
	Bucket           string               `json:"bucket" validate:"required,bucket-name"`
	Entries          []DownloadBatchEntry `json:"entries" validate:"required,min=1,dive"`
	TargetDirectory  string               `json:"targetDirectory"`
	ArchiveName      string               `json:"archiveName"`
	ConflictStrategy string               `json:"conflictStrategy"`
}

// DownloadBatchEntry represents a single source object when building an archive.
type DownloadBatchEntry struct {
	Bucket       string `json:"bucket" validate:"required,bucket-name"`
	Key          string `json:"key" validate:"required,object-key"`
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
