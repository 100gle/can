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
	Sid       string         `json:"sid"`
	Effect    string         `json:"effect"`
	Principal any            `json:"principal"`
	Action    any            `json:"action"`
	Resource  any            `json:"resource"`
	Condition map[string]any `json:"condition"`
}

// ACLGrant summarises a single ACL entry for bucket-level permissions.
type ACLGrant struct {
	GranteeType string `json:"granteeType"`
	Grantee     string `json:"grantee"`
	Permission  string `json:"permission"`
	DisplayName string `json:"displayName,omitempty"`
	URI         string `json:"uri,omitempty"`
}

// BucketACL captures the owner info and grant list for a bucket.
type BucketACL struct {
	OwnerID          string     `json:"ownerId"`
	OwnerDisplayName string     `json:"ownerDisplayName"`
	Canned           string     `json:"canned"`
	Grants           []ACLGrant `json:"grants"`
	Updated          time.Time  `json:"updated" ts_type:"string"`
}

// PublicAccessBlock mirrors the AWS block public access switches.
type PublicAccessBlock struct {
	BlockPublicAcls       bool      `json:"blockPublicAcls"`
	IgnorePublicAcls      bool      `json:"ignorePublicAcls"`
	BlockPublicPolicy     bool      `json:"blockPublicPolicy"`
	RestrictPublicBuckets bool      `json:"restrictPublicBuckets"`
	Updated               time.Time `json:"updated" ts_type:"string"`
}

// BucketReferer stores Referer whitelist configuration for OSS/COS.
type BucketReferer struct {
	Enabled    bool      `json:"enabled"`
	AllowEmpty bool      `json:"allowEmpty"`
	Whitelist  []string  `json:"whitelist"`
	Mode       string    `json:"mode"`
	Updated    time.Time `json:"updated" ts_type:"string"`
}
