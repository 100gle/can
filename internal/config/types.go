package config

import "can/internal/storage"

// BucketEncryption describes default server-side encryption rules.
// This is a simplified representation for the frontend.
type BucketEncryption struct {
	Enabled   bool   `json:"enabled"`
	Algorithm string `json:"algorithm" validate:"required_if=Enabled true"`
	KmsKeyID  string `json:"kmsKeyId"`
}

// LifecycleRule wraps a subset of the AWS lifecycle configuration for UI display.
// Note: This is a simplified representation; the storage layer uses the full AWS schema.
type LifecycleRule struct {
	ID             string `json:"id"`
	Prefix         string `json:"prefix"`
	Status         string `json:"status" validate:"required,oneof=Enabled Disabled"`
	ExpirationDays int    `json:"expirationDays"`
	TransitionDays int    `json:"transitionDays"`
	NoncurrentDays int    `json:"noncurrentDays"`
}

// BucketCORS bundles CORS configuration rules.
type BucketCORS struct {
	Rules []storage.CORSRule `json:"rules" validate:"required,min=1,dive"`
}

// BucketWebsite represents the static website hosting configuration for UI.
// Note: This is a simplified representation for display purposes.
type BucketWebsite struct {
	Enabled  bool   `json:"enabled"`
	IndexKey string `json:"indexKey" validate:"required_if=Enabled true"`
	ErrorKey string `json:"errorKey"`
}

// BucketPolicy captures the IAM policy JSON structure.
type BucketPolicy struct {
	Version   string            `json:"version" validate:"required"`
	Statement []PolicyStatement `json:"statement" validate:"required,min=1,dive"`
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
