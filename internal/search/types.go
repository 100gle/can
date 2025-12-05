package search

import "time"

// SearchQuery aggregates filtering options for object discovery.
type SearchQuery struct {
	AccountID  string `json:"accountId"`
	Bucket     string `json:"bucket"`
	Prefix     string `json:"prefix"`
	SearchText string `json:"searchText"`
	SortBy     string `json:"sortBy"`
	SortOrder  string `json:"sortOrder"`

	MinSize   int64             `json:"minSize"`
	MaxSize   int64             `json:"maxSize"`
	StartTime *time.Time        `json:"startTime" ts_type:"string"`
	EndTime   *time.Time        `json:"endTime" ts_type:"string"`
	FileTypes []string          `json:"fileTypes"`
	Tags      map[string]string `json:"tags"`

	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

// SearchResult captures a flattened object record suitable for UI tables.
type SearchResult struct {
	Key          string            `json:"key"`
	Bucket       string            `json:"bucket"`
	Size         int64             `json:"size"`
	LastModified time.Time         `json:"lastModified" ts_type:"string"`
	ETag         string            `json:"etag"`
	ContentType  string            `json:"contentType"`
	StorageClass string            `json:"storageClass"`
	Tags         map[string]string `json:"tags"`
	Score        float64           `json:"score"`
}

// SearchResponse bundles paginated results.
type SearchResponse struct {
	Results    []*SearchResult `json:"results"`
	Total      int64           `json:"total"`
	HasMore    bool            `json:"hasMore"`
	NextOffset int             `json:"nextOffset"`
}

// objectRecord is an internal representation for filtering and sorting logic.
type objectRecord struct {
	Key          string
	Bucket       string
	Size         int64
	LastModified time.Time
	ETag         string
	ContentType  string
	StorageClass string
	Tags         map[string]string
}
