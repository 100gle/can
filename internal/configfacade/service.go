package configfacade

import (
	"context"
	"fmt"

	"can/internal/accounts"
	"can/internal/config"
	"can/internal/types"
)

// Service guards bucket configuration calls behind provider capability checks.
type Service struct {
	accounts *accounts.Service
	config   *config.BucketConfigService
}

// NewService wires the capability-aware config facade.
func NewService(accounts *accounts.Service, cfg *config.BucketConfigService) *Service {
	return &Service{accounts: accounts, config: cfg}
}

func (s *Service) ensureCapability(ctx context.Context, accountID string, feature types.FeatureID) error {
	provider, err := s.accounts.AccountProvider(ctx, accountID)
	if err != nil {
		return err
	}
	if types.HasCapability(provider, feature) {
		return nil
	}
	return fmt.Errorf(capabilityError(provider, feature))
}

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

func (s *Service) GetVersioning(ctx context.Context, accountID, bucket string) (*config.BucketVersioning, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketVersioning); err != nil {
		return nil, err
	}
	return s.config.GetVersioning(ctx, accountID, bucket)
}

func (s *Service) EnableVersioning(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketVersioning); err != nil {
		return err
	}
	return s.config.EnableVersioning(ctx, accountID, bucket)
}

func (s *Service) SuspendVersioning(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketVersioning); err != nil {
		return err
	}
	return s.config.SuspendVersioning(ctx, accountID, bucket)
}

func (s *Service) GetEncryption(ctx context.Context, accountID, bucket string) (*config.BucketEncryption, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketEncryption); err != nil {
		return nil, err
	}
	return s.config.GetEncryption(ctx, accountID, bucket)
}

func (s *Service) SetEncryption(ctx context.Context, accountID, bucket string, encryption *config.BucketEncryption) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketEncryption); err != nil {
		return err
	}
	return s.config.SetEncryption(ctx, accountID, bucket, encryption)
}

func (s *Service) DeleteEncryption(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketEncryption); err != nil {
		return err
	}
	return s.config.DeleteEncryption(ctx, accountID, bucket)
}

func (s *Service) GetLifecycle(ctx context.Context, accountID, bucket string) ([]*config.LifecycleRule, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketLifecycle); err != nil {
		return nil, err
	}
	return s.config.GetLifecycle(ctx, accountID, bucket)
}

func (s *Service) SetLifecycle(ctx context.Context, accountID, bucket string, rules []*config.LifecycleRule) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketLifecycle); err != nil {
		return err
	}
	return s.config.SetLifecycle(ctx, accountID, bucket, rules)
}

func (s *Service) DeleteLifecycle(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketLifecycle); err != nil {
		return err
	}
	return s.config.DeleteLifecycle(ctx, accountID, bucket)
}

func (s *Service) GetCORS(ctx context.Context, accountID, bucket string) (*config.BucketCORS, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketCORS); err != nil {
		return nil, err
	}
	return s.config.GetCORS(ctx, accountID, bucket)
}

func (s *Service) SetCORS(ctx context.Context, accountID, bucket string, cors *config.BucketCORS) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketCORS); err != nil {
		return err
	}
	return s.config.SetCORS(ctx, accountID, bucket, cors)
}

func (s *Service) DeleteCORS(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketCORS); err != nil {
		return err
	}
	return s.config.DeleteCORS(ctx, accountID, bucket)
}

func (s *Service) GetWebsite(ctx context.Context, accountID, bucket string) (*config.BucketWebsite, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketWebsite); err != nil {
		return nil, err
	}
	return s.config.GetWebsite(ctx, accountID, bucket)
}

func (s *Service) SetWebsite(ctx context.Context, accountID, bucket string, website *config.BucketWebsite) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketWebsite); err != nil {
		return err
	}
	return s.config.SetWebsite(ctx, accountID, bucket, website)
}

func (s *Service) DeleteWebsite(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketWebsite); err != nil {
		return err
	}
	return s.config.DeleteWebsite(ctx, accountID, bucket)
}

func (s *Service) GetPolicy(ctx context.Context, accountID, bucket string) (*config.BucketPolicy, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPolicy); err != nil {
		return nil, err
	}
	return s.config.GetPolicy(ctx, accountID, bucket)
}

func (s *Service) SetPolicy(ctx context.Context, accountID, bucket string, policy *config.BucketPolicy) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPolicy); err != nil {
		return err
	}
	return s.config.SetPolicy(ctx, accountID, bucket, policy)
}

func (s *Service) DeletePolicy(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPolicy); err != nil {
		return err
	}
	return s.config.DeletePolicy(ctx, accountID, bucket)
}
