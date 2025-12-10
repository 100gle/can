package oss

import (
	"context"
	"strings"

	"github.com/aliyun/aliyun-oss-go-sdk/oss"

	"can/internal/storage"
	"can/internal/storage/s3"
	"can/internal/types"
)

// NewStorageClient creates a new OSS-compatible storage client.
// It wraps the standard S3 client for most operations but uses native OSS SDK for extended features.
func NewStorageClient(ctx context.Context, creds storage.ConnectionCredentials) (storage.StorageClient, error) {
	endpoint := resolveOSSEndpoint(creds)

	// 2. Create standard S3 client as base (using resolved endpoint)
	s3Creds := creds
	s3Creds.Endpoint = endpoint
	s3Creds.Provider = types.ProviderOSS // Ensure provider is set for correct path style
	base, err := s3.NewStorageClient(ctx, s3Creds)
	if err != nil {
		return nil, err
	}

	// 3. Create Native OSS client
	ossClient, err := oss.New(endpoint, creds.AccessKeyID, creds.SecretAccessKey)
	if err != nil {
		return nil, err
	}

	return &ossAdapter{
		StorageClient: base,
		ossClient:     ossClient,
	}, nil
}

type ossAdapter struct {
	storage.StorageClient
	ossClient *oss.Client
}

func (a *ossAdapter) Provider() types.Provider {
	return types.ProviderOSS
}

func (a *ossAdapter) Capabilities() []types.ProviderCapability {
	return types.ProviderCapabilities(types.ProviderOSS)
}

func (a *ossAdapter) Buckets() storage.BucketDriver {
	return &bucketAdapter{
		BucketDriver: a.StorageClient.Buckets(),
		client:       a.ossClient,
	}
}

func (a *ossAdapter) Objects() storage.ObjectDriver {
	return &objectAdapter{
		ObjectDriver: a.StorageClient.Objects(),
		client:       a.ossClient,
	}
}

// bucketAdapter overrides specific bucket operations
type bucketAdapter struct {
	storage.BucketDriver
	client *oss.Client
}

// objectAdapter overrides specific object operations
type objectAdapter struct {
	storage.ObjectDriver
	client *oss.Client
}

func resolveOSSEndpoint(creds storage.ConnectionCredentials) string {
	endpoint := strings.TrimSpace(creds.Endpoint)
	if endpoint == "" {
		endpoint = "oss-cn-hangzhou.aliyuncs.com"
	}
	if !strings.Contains(endpoint, "://") {
		protocol := "https"
		if !creds.UseSSL {
			protocol = "http"
		}
		endpoint = protocol + "://" + endpoint
	}
	return endpoint
}
