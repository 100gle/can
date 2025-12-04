package types

import "strings"

// Provider enumerates supported S3-compatible vendors.
type Provider string

const (
	ProviderAWS    Provider = "aws"
	ProviderOSS    Provider = "oss"
	ProviderCOS    Provider = "cos"
	ProviderR2     Provider = "r2"
	ProviderCustom Provider = "custom"
)

// providerLabels maps provider codes to display labels.
var providerLabels = map[Provider]string{
	ProviderAWS:    "AWS S3",
	ProviderOSS:    "Aliyun OSS",
	ProviderCOS:    "Tencent COS",
	ProviderR2:     "Cloudflare R2",
	ProviderCustom: "Generic S3",
}

// ProviderMetadata carries UI-friendly provider information.
type ProviderMetadata struct {
	ID          Provider `json:"id"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
}

// KnownProviders returns metadata for all officially supported vendors.
func KnownProviders() []ProviderMetadata {
	return []ProviderMetadata{
		{ID: ProviderAWS, Label: providerLabels[ProviderAWS], Description: "Amazon S3 Regions & GovCloud"},
		{ID: ProviderOSS, Label: providerLabels[ProviderOSS], Description: "Aliyun Object Storage Service"},
		{ID: ProviderCOS, Label: providerLabels[ProviderCOS], Description: "Tencent Cloud Object Storage"},
		{ID: ProviderR2, Label: providerLabels[ProviderR2], Description: "Cloudflare R2"},
		{ID: ProviderCustom, Label: providerLabels[ProviderCustom], Description: "Generic S3-compatible endpoints"},
	}
}

// ParseProvider normalizes arbitrary provider strings into a supported constant.
func ParseProvider(raw string) Provider {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	for _, item := range []Provider{ProviderAWS, ProviderOSS, ProviderCOS, ProviderR2, ProviderCustom} {
		if normalized == string(item) {
			return item
		}
	}
	return ProviderCustom
}

// Label returns the friendly provider label.
func (p Provider) Label() string {
	if label, ok := providerLabels[p]; ok {
		return label
	}
	return providerLabels[ProviderCustom]
}
