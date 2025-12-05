package config

import "time"

// BucketVersioning represents basic versioning metadata for a bucket.
type BucketVersioning struct {
	Status string `json:"status"`
	// Updated indicates when the status was last fetched or changed.
	Updated time.Time `json:"updated" ts_type:"string"`
}

// BucketEncryption describes default server-side encryption rules.
type BucketEncryption struct {
	Enabled   bool      `json:"enabled"`
	Algorithm string    `json:"algorithm"`
	KmsKeyID  string    `json:"kmsKeyId"`
	Updated   time.Time `json:"updated" ts_type:"string"`
}

// LifecycleRule wraps a subset of the AWS lifecycle configuration.
type LifecycleRule struct {
	ID             string `json:"id"`
	Prefix         string `json:"prefix"`
	Status         string `json:"status"`
	ExpirationDays int    `json:"expirationDays"`
	TransitionDays int    `json:"transitionDays"`
	NoncurrentDays int    `json:"noncurrentDays"`
}

// BucketCORS bundles CORS configuration rules.
type BucketCORS struct {
	Rules []CORSRule `json:"rules"`
}

// CORSRule mirrors the S3 rule schema.
type CORSRule struct {
	AllowedOrigins []string `json:"allowedOrigins"`
	AllowedMethods []string `json:"allowedMethods"`
	AllowedHeaders []string `json:"allowedHeaders"`
	ExposeHeaders  []string `json:"exposeHeaders"`
	MaxAgeSeconds  int32    `json:"maxAgeSeconds"`
}

// BucketWebsite represents the static website hosting configuration.
type BucketWebsite struct {
	Enabled  bool   `json:"enabled"`
	IndexKey string `json:"indexKey"`
	ErrorKey string `json:"errorKey"`
}

// BucketPolicy captures the IAM policy JSON structure.
type BucketPolicy struct {
	Version   string            `json:"version"`
	Statement []PolicyStatement `json:"statement"`
	Raw       string            `json:"raw"`
}

// PolicyStatement mirrors AWS policy statements.
type PolicyStatement struct {
	Sid       string                 `json:"sid"`
	Effect    string                 `json:"effect"`
	Principal interface{}            `json:"principal"`
	Action    interface{}            `json:"action"`
	Resource  interface{}            `json:"resource"`
	Condition map[string]interface{} `json:"condition"`
}
