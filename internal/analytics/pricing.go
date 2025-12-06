package analytics

// DefaultPricingModels returns a map of provider keys to their default pricing structures.
// These are approximations as of late 2024.
func DefaultPricingModels() map[string]PricingModel {
	return map[string]PricingModel{
		"aws": {
			Provider:     "AWS S3",
			StorageRate:  0.023, // Standard
			DownloadRate: 0.09,  // Internet egress
			UploadRate:   0.0,   // Ingress is usually free
			RequestRate:  0.005, // Average of PUT/GET/LIST
			Currency:     "USD",
		},
		"oss": {
			Provider:     "Aliyun OSS",
			StorageRate:  0.017, // Approx converted
			DownloadRate: 0.07,
			UploadRate:   0.0,
			RequestRate:  0.001,
			Currency:     "USD",
		},
		"cos": {
			Provider:     "Tencent COS",
			StorageRate:  0.016,
			DownloadRate: 0.07,
			UploadRate:   0.0,
			RequestRate:  0.001,
			Currency:     "USD",
		},
		"r2": {
			Provider:     "Cloudflare R2",
			StorageRate:  0.015,
			DownloadRate: 0.0, // Free egress
			UploadRate:   0.0,
			RequestRate:  0.0, // Class B operations might cost, but mostly free
			Currency:     "USD",
		},
		"minio": {
			Provider:     "MinIO (Self-hosted)",
			StorageRate:  0.0,
			DownloadRate: 0.0,
			UploadRate:   0.0,
			RequestRate:  0.0,
			Currency:     "USD",
		},
	}
}

// GetPricingModel returns the pricing model for a given provider type.
// If unknown, returns a zero-cost model.
func GetPricingModel(providerType string) PricingModel {
	defaults := DefaultPricingModels()
	if model, ok := defaults[providerType]; ok {
		return model
	}
	// Default to zero cost for unknown/custom providers
	return PricingModel{
		Provider: providerType,
		Currency: "USD",
	}
}
