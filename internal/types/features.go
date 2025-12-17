package types

// FeatureID enumerates product-level capabilities that may vary per provider.
type FeatureID string

const (
	FeatureBucketStorageClass FeatureID = "bucket.storage_class"
	FeatureBucketMultiAZ      FeatureID = "bucket.multi_az"
	FeatureBucketCustomDomain FeatureID = "bucket.custom_domain"
	FeatureObjectSymlink      FeatureID = "object.symlink"
	FeatureBucketVersioning   FeatureID = "bucket.versioning"
	FeatureBucketEncryption   FeatureID = "bucket.encryption"
	FeatureBucketLifecycle    FeatureID = "bucket.lifecycle"
	FeatureBucketCORS         FeatureID = "bucket.cors"
	FeatureBucketWebsite      FeatureID = "bucket.website"
	FeatureBucketPolicy       FeatureID = "bucket.policy"
	FeatureBucketACL          FeatureID = "bucket.acl"
	FeatureBucketPublicAccess FeatureID = "bucket.public_access_block"
	FeatureBucketReferer      FeatureID = "bucket.referer"
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
	FeatureBucketVersioning: {
		ID:          FeatureBucketVersioning,
		Name:        "版本控制",
		Description: "启用后可保留对象的所有历史版本。",
		Category:    "bucket",
	},
	FeatureBucketEncryption: {
		ID:          FeatureBucketEncryption,
		Name:        "默认加密",
		Description: "配置存储桶级别的服务端加密策略。",
		Category:    "bucket",
	},
	FeatureBucketLifecycle: {
		ID:          FeatureBucketLifecycle,
		Name:        "生命周期管理",
		Description: "设置对象的过期、转换或归档规则。",
		Category:    "bucket",
	},
	FeatureBucketCORS: {
		ID:          FeatureBucketCORS,
		Name:        "CORS 规则",
		Description: "配置跨域访问控制策略。",
		Category:    "bucket",
	},
	FeatureBucketWebsite: {
		ID:          FeatureBucketWebsite,
		Name:        "静态网站托管",
		Description: "启用并管理静态网站入口文档与错误页。",
		Category:    "bucket",
	},
	FeatureBucketPolicy: {
		ID:          FeatureBucketPolicy,
		Name:        "Bucket 策略",
		Description: "编辑存储桶的 JSON 策略文档。",
		Category:    "bucket",
	},
	FeatureBucketACL: {
		ID:          FeatureBucketACL,
		Name:        "Bucket ACL",
		Description: "通过可视化界面管理 Owner/Grantee 权限。",
		Category:    "bucket",
	},
	FeatureBucketPublicAccess: {
		ID:          FeatureBucketPublicAccess,
		Name:        "阻止公共访问",
		Description: "一键阻断公共 ACL 与 Policy。",
		Category:    "bucket",
	},
	FeatureBucketReferer: {
		ID:          FeatureBucketReferer,
		Name:        "防盗链 Referer",
		Description: "配置 Referer 白名单避免盗链。",
		Category:    "bucket",
	},
}

// FeatureMetadata describes a capability in UI-friendly terms.
type FeatureMetadata struct {
	ID          FeatureID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Category    string    `json:"category"`
}

// ProviderFeature states if a feature is available for a provider.
type ProviderFeature struct {
	Provider    Provider  `json:"provider"`
	FeatureID   FeatureID `json:"featureId"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Supported   bool      `json:"supported"`
	Message     string    `json:"message,omitempty"`
}

// providerFeatureMatrix enumerates the current support map.
var providerFeatureMatrix = map[Provider]map[FeatureID]ProviderFeature{
	ProviderAWS: buildFeatureEntry(ProviderAWS, map[FeatureID]bool{
		FeatureBucketStorageClass: true,
		FeatureBucketMultiAZ:      true,
		FeatureBucketCustomDomain: true,
		FeatureObjectSymlink:      false,
		FeatureBucketVersioning:   true,
		FeatureBucketEncryption:   true,
		FeatureBucketLifecycle:    true,
		FeatureBucketCORS:         true,
		FeatureBucketWebsite:      true,
		FeatureBucketPolicy:       true,
		FeatureBucketACL:          true,
		FeatureBucketPublicAccess: true,
		FeatureBucketReferer:      false,
	}, map[FeatureID]string{
		FeatureObjectSymlink: "AWS S3 暂不支持对象级软链接。",
		FeatureBucketReferer: "AWS S3 未提供 Referer 白名单能力。",
	}),
	ProviderOSS: buildFeatureEntry(ProviderOSS, map[FeatureID]bool{
		FeatureBucketStorageClass: true,
		FeatureBucketMultiAZ:      false,
		FeatureBucketCustomDomain: true,
		FeatureObjectSymlink:      true,
		FeatureBucketACL:          true,
		FeatureBucketPublicAccess: false,
		FeatureBucketReferer:      true,
	}, map[FeatureID]string{
		FeatureBucketMultiAZ:      "阿里云 OSS 当前仅提供同城多活，暂未开放跨可用区冗余开关。",
		FeatureBucketVersioning:   "阿里云 OSS 尚未开放在 CAN 中管理版本控制。",
		FeatureBucketEncryption:   "阿里云 OSS 暂不支持通过 CAN 配置默认加密。",
		FeatureBucketLifecycle:    "阿里云 OSS 暂不支持在 CAN 中管理生命周期规则。",
		FeatureBucketCORS:         "阿里云 OSS 暂不支持通过 CAN 管理 CORS。",
		FeatureBucketWebsite:      "阿里云 OSS 暂未开放静态网站托管设置。",
		FeatureBucketPolicy:       "阿里云 OSS 暂不支持在 CAN 中编辑 Bucket Policy。",
		FeatureBucketPublicAccess: "阿里云 OSS 暂未开放阻止公共访问的 API。",
	}),
	ProviderCOS: buildFeatureEntry(ProviderCOS, map[FeatureID]bool{
		FeatureBucketStorageClass: true,
		FeatureBucketMultiAZ:      true,
		FeatureBucketCustomDomain: true,
		FeatureObjectSymlink:      false,
		FeatureBucketACL:          true,
		FeatureBucketPublicAccess: false,
		FeatureBucketReferer:      true,
	}, map[FeatureID]string{
		FeatureObjectSymlink:      "腾讯云 COS 暂不支持软链接能力。",
		FeatureBucketVersioning:   "腾讯云 COS 暂不支持通过 CAN 管理版本控制。",
		FeatureBucketEncryption:   "腾讯云 COS 暂不支持通过 CAN 配置默认加密。",
		FeatureBucketLifecycle:    "腾讯云 COS 暂不支持在 CAN 中管理生命周期规则。",
		FeatureBucketCORS:         "腾讯云 COS 暂不支持通过 CAN 管理 CORS。",
		FeatureBucketWebsite:      "腾讯云 COS 暂未开放静态网站托管设置。",
		FeatureBucketPolicy:       "腾讯云 COS 暂不支持在 CAN 中编辑 Bucket Policy。",
		FeatureBucketPublicAccess: "腾讯云 COS 暂未提供公共访问阻断配置。",
	}),
	ProviderR2: buildFeatureEntry(ProviderR2, map[FeatureID]bool{
		FeatureBucketStorageClass: false,
		FeatureBucketMultiAZ:      false,
		FeatureBucketCustomDomain: true,
		FeatureObjectSymlink:      false,
		FeatureBucketACL:          false,
		FeatureBucketPublicAccess: false,
		FeatureBucketReferer:      false,
	}, map[FeatureID]string{
		FeatureBucketStorageClass: "R2 仅提供单一存储类型。",
		FeatureBucketMultiAZ:      "R2 自动管理弹性冗余，无法自定义。",
		FeatureObjectSymlink:      "R2 暂无软链接能力。",
		FeatureBucketVersioning:   "Cloudflare R2 暂未开放版本控制配置。",
		FeatureBucketEncryption:   "Cloudflare R2 暂不支持自定义默认加密。",
		FeatureBucketLifecycle:    "Cloudflare R2 暂不支持生命周期管理。",
		FeatureBucketCORS:         "Cloudflare R2 暂不支持通过 CAN 管理 CORS。",
		FeatureBucketWebsite:      "Cloudflare R2 暂不支持静态网站托管配置。",
		FeatureBucketPolicy:       "Cloudflare R2 暂不支持编辑 Bucket Policy。",
		FeatureBucketACL:          "Cloudflare R2 暂不支持 ACL 管理。",
		FeatureBucketPublicAccess: "Cloudflare R2 暂无公共访问阻断。",
		FeatureBucketReferer:      "Cloudflare R2 暂不支持 Referer 白名单。",
	}),
	ProviderCustom: buildFeatureEntry(ProviderCustom, map[FeatureID]bool{
		FeatureBucketStorageClass: false,
		FeatureBucketMultiAZ:      false,
		FeatureBucketCustomDomain: false,
		FeatureObjectSymlink:      false,
		FeatureBucketACL:          false,
		FeatureBucketPublicAccess: false,
		FeatureBucketReferer:      false,
	}, map[FeatureID]string{
		FeatureBucketStorageClass: "请联系供应商确认是否支持自定义存储类型。",
		FeatureBucketMultiAZ:      "未知供应商无法确认多 AZ 支持情况。",
		FeatureBucketCustomDomain: "未知供应商无法确认自定义域名支持情况。",
		FeatureObjectSymlink:      "未知供应商无法确认软链接支持情况。",
		FeatureBucketVersioning:   "未知供应商暂不支持版本控制配置。",
		FeatureBucketEncryption:   "未知供应商暂不支持默认加密配置。",
		FeatureBucketLifecycle:    "未知供应商暂不支持生命周期管理。",
		FeatureBucketCORS:         "未知供应商暂不支持 CORS 配置。",
		FeatureBucketWebsite:      "未知供应商暂不支持静态网站托管。",
		FeatureBucketPolicy:       "未知供应商暂不支持 Bucket Policy。",
	}),
}

func buildFeatureEntry(provider Provider, support map[FeatureID]bool, messages map[FeatureID]string) map[FeatureID]ProviderFeature {
	result := make(map[FeatureID]ProviderFeature, len(featureCatalog))
	for id, feature := range featureCatalog {
		supported := support[id]
		message := messages[id]
		if supported {
			message = ""
		} else if message == "" {
			message = "该功能由其它供应商提供。"
		}
		result[id] = ProviderFeature{
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

// ProviderFeatures returns the capability list for a single provider.
func ProviderFeatures(provider Provider) []ProviderFeature {
	matrix, ok := providerFeatureMatrix[provider]
	if !ok {
		return nil
	}
	items := make([]ProviderFeature, 0, len(matrix))
	for _, capability := range matrix {
		items = append(items, capability)
	}
	return items
}

// FeatureMatrix flattens all provider capabilities for serialization.
func FeatureMatrix() []ProviderFeature {
	var result []ProviderFeature
	for provider := range providerFeatureMatrix {
		result = append(result, ProviderFeatures(provider)...)
	}
	return result
}

// HasFeature reports whether the provider declares the requested feature.
func HasFeature(provider Provider, feature FeatureID) bool {
	if matrix, ok := providerFeatureMatrix[provider]; ok {
		if capability, ok := matrix[feature]; ok {
			return capability.Supported
		}
	}
	return false
}
