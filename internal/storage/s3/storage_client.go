package s3

import (
	"context"

	"can/internal/storage"
	"can/internal/types"
)

// StorageClient implements storage.StorageClient using AWS S3 SDK.
type StorageClient struct {
	provider types.Provider
	client   S3Client
	creds    storage.ConnectionCredentials
}

// NewClient creates a new S3-based storage client.
func NewClient(ctx context.Context, creds storage.ConnectionCredentials) (storage.StorageClient, error) {
	factory := NewClientFactory()
	client, err := factory.NewClient(ctx, creds)
	if err != nil {
		return nil, err
	}
	return &StorageClient{
		provider: creds.Provider,
		client:   client,
		creds:    creds,
	}, nil
}

func (c *StorageClient) Provider() types.Provider {
	return c.provider
}

func (c *StorageClient) Capabilities() []types.ProviderCapability {
	return types.ProviderCapabilities(c.provider)
}

func (c *StorageClient) Buckets() storage.BucketDriver {
	return &s3BucketDriver{client: c.client, creds: c.creds}
}

func (c *StorageClient) Objects() storage.ObjectDriver {
	return &s3ObjectDriver{client: c.client}
}

func (c *StorageClient) Security() storage.SecurityDriver {
	if c.provider == types.ProviderAWS {
		return &AWSSecurityDriver{Creds: c.creds}
	}
	// Future: Add OSS/COS implementation here
	return &UnimplementedSecurityDriver{}
}
