package objects

import "time"

// ObjectInfo describes a file or pseudo-folder inside a bucket.
type ObjectInfo struct {
	Key          string    `json:"key"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"lastModified" ts_type:"string"`
	ETag         string    `json:"etag"`
	ContentType  string    `json:"contentType"`
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
