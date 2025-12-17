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
	accounts *accounts.Service
	vault    *storage.ClientVault
}

// NewBucketConfigService wires account and provider dependencies.
func NewBucketConfigService(accounts *accounts.Service, vault *storage.ClientVault) *BucketConfigService {
	return &BucketConfigService{
		accounts: accounts,
		vault:    vault,
	}
}

func (s *BucketConfigService) client(ctx context.Context, accountID, bucket string) (*storage.Client, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, errors.New("account id is required")
	}
	bucket = strings.TrimSpace(bucket)
	if bucket == "" {
		return nil, ErrBucketRequired
	}
	if s.vault == nil {
		return nil, errors.New("client vault not configured")
	}
	client, err := s.accounts.GetClient(ctx, s.vault, accountID)
	if err != nil {
		return nil, err
	}
	if !s.supportsConfig(client.Provider) {
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedProvider, client.Provider)
	}
	return client, nil
}

// ensureCapability checks if the account's provider supports the specified feature.
func (s *BucketConfigService) ensureCapability(ctx context.Context, accountID string, feature types.FeatureID) error {
	provider, err := s.accountProvider(ctx, accountID)
	if err != nil {
		return err
	}
	if types.HasFeature(provider, feature) {
		return nil
	}
	return errors.New(capabilityError(provider, feature))
}

// capabilityError generates a user-friendly error message for unsupported capabilities.
func capabilityError(provider types.Provider, feature types.FeatureID) string {
	for _, entry := range types.ProviderFeatures(provider) {
		if entry.FeatureID == feature {
			if entry.Message != "" {
				return entry.Message
			}
			return fmt.Sprintf("%s 暂不支持 %s", provider.Label(), entry.Name)
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
	creds, err := s.accounts.Credentials(ctx, accountID)
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
		if types.HasFeature(provider, feature) {
			return true
		}
	}
	return false
}
