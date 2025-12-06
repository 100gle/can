package objects

import "time"

// ObjectInfo describes a file or pseudo-folder inside a bucket.
type ObjectInfo struct {
	Key          string    `json:"key"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"lastModified" ts_type:"string"`
	ETag         string    `json:"etag"`
	ContentType  string    `json:"contentType"`
	StorageClass string    `json:"storageClass"`
	VersionID    string    `json:"versionId"`
	IsDir        bool      `json:"isDir"`
}

// ListObjectsInput specifies the listing boundaries.
type ListObjectsInput struct {
	Bucket    string `json:"bucket"`
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
	SourceBucket string `json:"sourceBucket"`
	SourceKey    string `json:"sourceKey"`
	TargetBucket string `json:"targetBucket"`
	TargetKey    string `json:"targetKey"`
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
	Bucket       string            `json:"bucket"`
	Key          string            `json:"key"`
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
