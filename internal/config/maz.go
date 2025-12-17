package config

import (
	"context"
	"errors"
	"fmt"

	"can/internal/storage"
	"can/internal/types"
)

// GetBucketMAZConfig inspects the provider-specific MAZ status.
func (s *BucketConfigService) GetBucketMAZConfig(ctx context.Context, accountID, bucket string) (*storage.MAZConfiguration, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketMultiAZ); err != nil {
		return nil, err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	cfg, err := client.Bucket.GetBucketMAZConfig(ctx, bucket)
	if err != nil {
		if errors.Is(err, storage.ErrUnsupportedFeature) {
			return nil, fmt.Errorf("%s 不支持多可用区配置查询", client.Provider.Label())
		}
		return nil, err
	}
	return cfg, nil
}

// EnableBucketMAZ attempts to toggle Multi-AZ after bucket creation.
func (s *BucketConfigService) EnableBucketMAZ(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketMultiAZ); err != nil {
		return err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if err := client.Bucket.EnableBucketMAZ(ctx, bucket); err != nil {
		if errors.Is(err, storage.ErrUnsupportedFeature) {
			return fmt.Errorf("%s 暂不支持在创建后开启多可用区", client.Provider.Label())
		}
		return err
	}
	return nil
}

// DisableBucketMAZ attempts to downgrade a bucket back to single AZ.
func (s *BucketConfigService) DisableBucketMAZ(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketMultiAZ); err != nil {
		return err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if err := client.Bucket.DisableBucketMAZ(ctx, bucket); err != nil {
		if errors.Is(err, storage.ErrUnsupportedFeature) {
			return fmt.Errorf("%s 暂不支持关闭多可用区", client.Provider.Label())
		}
		return err
	}
	return nil
}
