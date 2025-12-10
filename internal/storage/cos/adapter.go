package cos

import (
	"context"
	"fmt"
	"net/http"
	"net/url"

	"github.com/tencentyun/cos-go-sdk-v5"

	"can/internal/storage"
	"can/internal/storage/s3"
	"can/internal/types"
)

// NewStorageClient creates a new COS-compatible storage client.
func NewStorageClient(ctx context.Context, creds storage.ConnectionCredentials) (storage.StorageClient, error) {
	// 1. Create standard S3 client with correct provider
	s3Creds := creds
	s3Creds.Provider = types.ProviderCOS // Ensure provider is set for correct path style
	base, err := s3.NewStorageClient(ctx, s3Creds)
	if err != nil {
		return nil, err
	}

	return &cosAdapter{
		StorageClient: base,
		creds:         creds,
	}, nil
}

type cosAdapter struct {
	storage.StorageClient
	creds storage.ConnectionCredentials
}

func (a *cosAdapter) Provider() types.Provider {
	return types.ProviderCOS
}

func (a *cosAdapter) Capabilities() []types.ProviderCapability {
	return types.ProviderCapabilities(types.ProviderCOS)
}

func (a *cosAdapter) Buckets() storage.BucketDriver {
	return &bucketAdapter{
		BucketDriver: a.StorageClient.Buckets(),
		creds:        a.creds,
	}
}

// bucketAdapter overrides specific bucket operations
type bucketAdapter struct {
	storage.BucketDriver
	creds storage.ConnectionCredentials
}

func (b *bucketAdapter) buildClient(bucketName string) *cos.Client {
	// Construct the bucket URL.
	// Default pattern: https://<bucket>-<appid>.cos.<region>.myqcloud.com
	// We assume bucketName might contain AppID or we rely on user providing correct name.
	// If Endpoint is customized in creds (e.g. global accelerator), we might need to handle differently.
	// For now, use standard pattern + Region from creds.

	region := b.creds.Region
	if region == "" {
		region = "ap-guangzhou" // Fallback
	}

	bucketURL, _ := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", bucketName, region))
	baseURL := &cos.BaseURL{BucketURL: bucketURL}

	return cos.NewClient(baseURL, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  b.creds.AccessKeyID,
			SecretKey: b.creds.SecretAccessKey,
		},
	})
}
