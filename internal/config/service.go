package config

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/types"
)

// ErrBucketRequired indicates the caller did not specify a bucket name.
var ErrBucketRequired = errors.New("bucket name is required")

// ErrUnsupportedProvider is returned when the provider cannot manipulate bucket configs.
var ErrUnsupportedProvider = errors.New("bucket configuration unsupported for provider")

// BucketConfigService orchestrates advanced bucket configuration operations.
type BucketConfigService struct {
	accounts       *accounts.Service
	factory        providers.S3ClientFactory
	storageFactory providers.StorageFactory
}

// NewBucketConfigService wires account and provider dependencies.
func NewBucketConfigService(accounts *accounts.Service, factory providers.S3ClientFactory, storageFactory providers.StorageFactory) *BucketConfigService {
	if factory == nil {
		factory = providers.NewS3ClientFactory()
	}
	if storageFactory == nil {
		storageFactory = providers.NewStorageFactory(factory)
	}
	return &BucketConfigService{
		accounts:       accounts,
		factory:        factory,
		storageFactory: storageFactory,
	}
}

func (s *BucketConfigService) client(ctx context.Context, accountID, bucket string) (providers.S3Client, providers.ConnectionCredentials, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, providers.ConnectionCredentials{}, errors.New("account id is required")
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return nil, providers.ConnectionCredentials{}, ErrBucketRequired
	}
	creds, err := s.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	if !s.supportsConfig(creds.Provider) {
		return nil, providers.ConnectionCredentials{}, fmt.Errorf("%w: %s", ErrUnsupportedProvider, creds.Provider)
	}
	client, err := s.factory.NewClient(ctx, creds)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	return client, creds, nil
}

func (s *BucketConfigService) supportsConfig(provider types.Provider) bool {
	// Check if the provider supports any bucket configuration capabilities
	bucketConfigFeatures := []types.FeatureID{
		types.FeatureBucketACL,
		types.FeatureBucketReferer,
		types.FeatureBucketPublicAccess,
		types.FeatureBucketPolicy,
		types.FeatureBucketVersioning,
		types.FeatureBucketEncryption,
		types.FeatureBucketLifecycle,
		types.FeatureBucketCORS,
		types.FeatureBucketWebsite,
	}
	for _, feature := range bucketConfigFeatures {
		if types.HasCapability(provider, feature) {
			return true
		}
	}
	return false
}

func (s *BucketConfigService) storageClient(ctx context.Context, accountID, bucket string) (providers.StorageClient, providers.ConnectionCredentials, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, providers.ConnectionCredentials{}, errors.New("account id is required")
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return nil, providers.ConnectionCredentials{}, ErrBucketRequired
	}
	if s.storageFactory == nil {
		return nil, providers.ConnectionCredentials{}, errors.New("storage factory not configured")
	}
	creds, err := s.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	client, err := s.storageFactory.NewClient(ctx, creds)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	return client, creds, nil
}
