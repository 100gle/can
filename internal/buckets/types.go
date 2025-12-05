package buckets

import "time"

// BucketInfo captures the essential attributes of a storage bucket.
type BucketInfo struct {
	Name        string    `json:"name"`
	CreatedAt   time.Time `json:"createdAt" ts_type:"string"`
	Region      string    `json:"region"`
	ObjectCount int64     `json:"objectCount"`
	Size        int64     `json:"size"`
}
