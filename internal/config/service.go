package config

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"can/internal/accounts"
	"can/internal/storage"
	"can/internal/types"
)

// ErrBucketRequired indicates the caller did not specify a bucket name.
var ErrBucketRequired = errors.New("bucket name is required")

// ErrUnsupportedProvider is returned when the provider cannot manipulate bucket configs.
var ErrUnsupportedProvider = errors.New("bucket configuration unsupported for provider")

// BucketConfigService orchestrates advanced bucket configuration operations.
type BucketConfigService struct {
	accounts       *accounts.Service
	storageFactory storage.StorageFactory
}

// NewBucketConfigService wires account and provider dependencies.
func NewBucketConfigService(accounts *accounts.Service, storageFactory storage.StorageFactory) *BucketConfigService {
	// If no factory provided, create a default one (without specific S3 factory injection, rely on default)
	if storageFactory == nil {
		storageFactory = storage.NewStorageFactory()
	}
	return &BucketConfigService{
		accounts:       accounts,
		storageFactory: storageFactory,
	}
}

func (s *BucketConfigService) client(ctx context.Context, accountID, bucket string) (storage.StorageClient, storage.ConnectionCredentials, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, storage.ConnectionCredentials{}, errors.New("account id is required")
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return nil, storage.ConnectionCredentials{}, ErrBucketRequired
	}
	creds, err := s.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return nil, storage.ConnectionCredentials{}, err
	}
	if !s.supportsConfig(creds.Provider) {
		return nil, storage.ConnectionCredentials{}, fmt.Errorf("%w: %s", ErrUnsupportedProvider, creds.Provider)
	}
	client, err := s.storageFactory.NewClient(ctx, creds)
	if err != nil {
		return nil, storage.ConnectionCredentials{}, err
	}
	return client, creds, nil
}

// ensureCapability checks if the account's provider supports the specified feature.
func (s *BucketConfigService) ensureCapability(ctx context.Context, accountID string, feature types.FeatureID) error {
	provider, err := s.accountProvider(ctx, accountID)
	if err != nil {
		return err
	}
	if types.HasCapability(provider, feature) {
		return nil
	}
	return errors.New(capabilityError(provider, feature))
}

// capabilityError generates a user-friendly error message for unsupported capabilities.
func capabilityError(provider types.Provider, feature types.FeatureID) string {
	for _, capability := range types.ProviderCapabilities(provider) {
		if capability.FeatureID == feature {
			if capability.Message != "" {
				return capability.Message
			}
			return fmt.Sprintf("%s 暂不支持 %s", provider.Label(), capability.Name)
		}
	}
	return fmt.Sprintf("%s 暂不支持该配置", provider.Label())
}

// accountProvider retrieves the provider type for the given account.
func (s *BucketConfigService) accountProvider(ctx context.Context, accountID string) (types.Provider, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return "", errors.New("account id is required")
	}
	creds, err := s.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return "", err
	}
	return creds.Provider, nil
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

// storageClient is deprecated; use client() instead. Keeping for now if used internally.
// But wait, client() now returns what storageClient used to return (plus checking supportsConfig).
// The original storageClient did NOT check supportsConfig.
// Let's keep a method that strictly follows the original storageClient behavior but uses storage package.
func (s *BucketConfigService) storageClient(ctx context.Context, accountID, bucket string) (storage.StorageClient, storage.ConnectionCredentials, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, storage.ConnectionCredentials{}, errors.New("account id is required")
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return nil, storage.ConnectionCredentials{}, ErrBucketRequired
	}
	if s.storageFactory == nil {
		return nil, storage.ConnectionCredentials{}, errors.New("storage factory not configured")
	}
	creds, err := s.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return nil, storage.ConnectionCredentials{}, err
	}
	client, err := s.storageFactory.NewClient(ctx, creds)
	if err != nil {
		return nil, storage.ConnectionCredentials{}, err
	}
	return client, creds, nil
}
