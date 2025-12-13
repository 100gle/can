package storage

import (
	"can/internal/types"

	ossSDK "github.com/aliyun/aliyun-oss-go-sdk/oss"
	"github.com/minio/minio-go/v7"
	"github.com/qiniu/go-sdk/v7/auth/qbox"
	qiniuStorage "github.com/qiniu/go-sdk/v7/storage"
	cosSDK "github.com/tencentyun/cos-go-sdk-v5"
)

// QiniuSDK bundles commonly used Kodo handles for escape-hatch scenarios.
type QiniuSDK struct {
	Mac           *qbox.Mac
	BucketManager *qiniuStorage.BucketManager
	Config        *qiniuStorage.Config
}

// VendorSDK enumerates allowed SDK escape-hatch types per provider.
type VendorSDK interface {
	*ossSDK.Client | *cosSDK.Client | *minio.Client | *QiniuSDK | struct{}
}

// Client is the generic storage client with typed SDK access.
type Client[SDK VendorSDK] struct {
	provider types.Provider
	s3       S3Client
	sdk      SDK
	bucket   BucketAPI
	object   ObjectAPI
	security SecurityAPI
	caps     []types.ProviderCapability
}

// Provider returns the storage provider.
func (c *Client[SDK]) Provider() types.Provider {
	return c.provider
}

// Capabilities returns provider capability metadata.
func (c *Client[SDK]) Capabilities() []types.ProviderCapability {
	return c.caps
}

// Bucket exposes bucket-level operations (singular per design doc).
func (c *Client[SDK]) Bucket() BucketAPI {
	return c.bucket
}

// Object exposes object-level operations (singular per design doc).
func (c *Client[SDK]) Object() ObjectAPI {
	return c.object
}

// Security exposes security/STS operations.
func (c *Client[SDK]) Security() SecurityAPI {
	return c.security
}

// SDK returns the typed vendor SDK handle (escape hatch).
func (c *Client[SDK]) SDK() SDK {
	return c.sdk
}

// S3 exposes the underlying S3-compatible client for rare cases.
func (c *Client[SDK]) S3() S3Client {
	return c.s3
}

// Buckets returns the bucket API for legacy callers.
func (c *Client[SDK]) Buckets() BucketAPI {
	return c.bucket
}

// Objects returns the object API for legacy callers.
func (c *Client[SDK]) Objects() ObjectAPI {
	return c.object
}

// As attempts to cast the underlying SDK to the requested type.
func As[SDK VendorSDK, T VendorSDK](c *Client[SDK]) (T, bool) {
	var zero T
	if c == nil {
		return zero, false
	}
	if v, ok := any(c.sdk).(T); ok {
		return v, true
	}
	return zero, false
}
