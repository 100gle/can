package types

// FeatureID enumerates product-level capabilities that may vary per provider.
type FeatureID string

const (
	FeatureBucketStorageClass FeatureID = "bucket.storage_class"
	FeatureBucketMultiAZ      FeatureID = "bucket.multi_az"
	FeatureBucketCustomDomain FeatureID = "bucket.custom_domain"
	FeatureObjectSymlink      FeatureID = "object.symlink"
)

// featureCatalog defines the descriptive metadata for known features.
var featureCatalog = map[FeatureID]FeatureMetadata{
	FeatureBucketStorageClass: {
		ID:          FeatureBucketStorageClass,
		Name:        "自定义存储类型",
		Description: "在创建存储桶或对象时选择不同的存储类型（标准、低频、归档等）。",
		Category:    "bucket",
	},
	FeatureBucketMultiAZ: {
		ID:          FeatureBucketMultiAZ,
		Name:        "多 AZ 冗余",
		Description: "创建时为存储桶启用多可用区冗余或本地冗余策略。",
		Category:    "bucket",
	},
	FeatureBucketCustomDomain: {
		ID:          FeatureBucketCustomDomain,
		Name:        "自定义域名绑定",
		Description: "为对象存储绑定自定义域名并配置 HTTPS 证书。",
		Category:    "bucket",
	},
	FeatureObjectSymlink: {
		ID:          FeatureObjectSymlink,
		Name:        "对象软链接",
		Description: "为对象创建软链接（Symbolic Link）以复用数据。",
		Category:    "object",
	},
}

// FeatureMetadata describes a capability in UI-friendly terms.
type FeatureMetadata struct {
	ID          FeatureID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
}

// ProviderCapability states if a feature is available for a provider.
type ProviderCapability struct {
	Provider    Provider  `json:"provider"`
	FeatureID   FeatureID `json:"featureId"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Supported   bool      `json:"supported"`
	Message     string    `json:"message,omitempty"`
}

// providerCapabilityMatrix enumerates the current support map.
var providerCapabilityMatrix = map[Provider]map[FeatureID]ProviderCapability{
	ProviderAWS: buildCapabilityEntry(ProviderAWS, map[FeatureID]bool{
		FeatureBucketStorageClass: true,
		FeatureBucketMultiAZ:      true,
		FeatureBucketCustomDomain: true,
		FeatureObjectSymlink:      false,
	}, map[FeatureID]string{
		FeatureObjectSymlink: "AWS S3 暂不支持对象级软链接。",
	}),
	ProviderOSS: buildCapabilityEntry(ProviderOSS, map[FeatureID]bool{
		FeatureBucketStorageClass: true,
		FeatureBucketMultiAZ:      false,
		FeatureBucketCustomDomain: true,
		FeatureObjectSymlink:      true,
	}, map[FeatureID]string{
		FeatureBucketMultiAZ: "阿里云 OSS 当前仅提供同城多活，暂未开放跨可用区冗余开关。",
	}),
	ProviderCOS: buildCapabilityEntry(ProviderCOS, map[FeatureID]bool{
		FeatureBucketStorageClass: true,
		FeatureBucketMultiAZ:      true,
		FeatureBucketCustomDomain: true,
		FeatureObjectSymlink:      false,
	}, map[FeatureID]string{
		FeatureObjectSymlink: "腾讯云 COS 暂不支持软链接能力。",
	}),
	ProviderR2: buildCapabilityEntry(ProviderR2, map[FeatureID]bool{
		FeatureBucketStorageClass: false,
		FeatureBucketMultiAZ:      false,
		FeatureBucketCustomDomain: true,
		FeatureObjectSymlink:      false,
	}, map[FeatureID]string{
		FeatureBucketStorageClass: "R2 仅提供单一存储类型。",
		FeatureBucketMultiAZ:      "R2 自动管理弹性冗余，无法自定义。",
		FeatureObjectSymlink:      "R2 暂无软链接能力。",
	}),
	ProviderCustom: buildCapabilityEntry(ProviderCustom, map[FeatureID]bool{
		FeatureBucketStorageClass: false,
		FeatureBucketMultiAZ:      false,
		FeatureBucketCustomDomain: false,
		FeatureObjectSymlink:      false,
	}, map[FeatureID]string{
		FeatureBucketStorageClass: "请联系供应商确认是否支持自定义存储类型。",
		FeatureBucketMultiAZ:      "未知供应商无法确认多 AZ 支持情况。",
		FeatureBucketCustomDomain: "未知供应商无法确认自定义域名支持情况。",
		FeatureObjectSymlink:      "未知供应商无法确认软链接支持情况。",
	}),
}

func buildCapabilityEntry(provider Provider, support map[FeatureID]bool, messages map[FeatureID]string) map[FeatureID]ProviderCapability {
	result := make(map[FeatureID]ProviderCapability, len(featureCatalog))
	for id, feature := range featureCatalog {
		supported := support[id]
		message := messages[id]
		if supported {
			message = ""
		} else if message == "" {
			message = "该功能由其它供应商提供。"
		}
		result[id] = ProviderCapability{
			Provider:    provider,
			FeatureID:   id,
			Name:        feature.Name,
			Description: feature.Description,
			Supported:   supported,
			Message:     message,
		}
	}
	return result
}

// ProviderCapabilities returns the capability list for a single provider.
func ProviderCapabilities(provider Provider) []ProviderCapability {
	matrix, ok := providerCapabilityMatrix[provider]
	if !ok {
		return nil
	}
	items := make([]ProviderCapability, 0, len(matrix))
	for _, capability := range matrix {
		items = append(items, capability)
	}
	return items
}

// CapabilityMatrix flattens all provider capabilities for serialization.
func CapabilityMatrix() []ProviderCapability {
	var result []ProviderCapability
	for provider := range providerCapabilityMatrix {
		result = append(result, ProviderCapabilities(provider)...)
	}
	return result
}

// HasCapability reports whether the provider declares the requested feature.
func HasCapability(provider Provider, feature FeatureID) bool {
	if matrix, ok := providerCapabilityMatrix[provider]; ok {
		if capability, ok := matrix[feature]; ok {
			return capability.Supported
		}
	}
	return false
}
