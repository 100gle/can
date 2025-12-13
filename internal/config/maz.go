package config

import (
	"context"
	"errors"
	"fmt"
	"time"

	"can/internal/storage"
	"can/internal/types"
)

// GetBucketMAZConfig inspects the provider-specific MAZ status.
func (s *BucketConfigService) GetBucketMAZConfig(ctx context.Context, accountID, bucket string) (*BucketMAZConfig, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketMultiAZ); err != nil {
		return nil, err
	}
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	cfg, err := client.Bucket().GetBucketMAZConfig(ctx, bucket)
	if err != nil {
		if errors.Is(err, storage.ErrUnsupportedCapability) {
			return nil, fmt.Errorf("%s 不支持多可用区配置查询", creds.Provider.Label())
		}
		return nil, err
	}
	return mapProviderMAZ(cfg), nil
}

// EnableBucketMAZ attempts to toggle Multi-AZ after bucket creation.
func (s *BucketConfigService) EnableBucketMAZ(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketMultiAZ); err != nil {
		return err
	}
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if err := client.Bucket().EnableBucketMAZ(ctx, bucket); err != nil {
		if errors.Is(err, storage.ErrUnsupportedCapability) {
			return fmt.Errorf("%s 暂不支持在创建后开启多可用区", creds.Provider.Label())
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
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if err := client.Bucket().DisableBucketMAZ(ctx, bucket); err != nil {
		if errors.Is(err, storage.ErrUnsupportedCapability) {
			return fmt.Errorf("%s 暂不支持关闭多可用区", creds.Provider.Label())
		}
		return err
	}
	return nil
}

func mapProviderMAZ(model *storage.MAZConfiguration) *BucketMAZConfig {
	if model == nil {
		return nil
	}
	return &BucketMAZConfig{
		Status:  model.Status,
		Updated: time.Now(),
	}
}
