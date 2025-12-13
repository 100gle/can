package config

import (
	"context"
	"fmt"
	"strings"
	"time"

	"can/internal/storage"
	"can/internal/types"
)

// GetVersioning returns the current bucket versioning status.
func (s *BucketConfigService) GetVersioning(ctx context.Context, accountID, bucket string) (*BucketVersioning, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketVersioning); err != nil {
		return nil, err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	verStatus, err := client.Bucket().GetBucketVersioning(ctx, strings.TrimSpace(bucket))
	if err != nil {
		return nil, fmt.Errorf("get bucket versioning: %w", err)
	}
	status := "Disabled"
	if verStatus != "" {
		status = string(verStatus)
	}
	return &BucketVersioning{
		Status:  status,
		Updated: time.Now(),
	}, nil
}

// EnableVersioning switches the bucket into Enabled state.
func (s *BucketConfigService) EnableVersioning(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketVersioning); err != nil {
		return err
	}
	return s.updateVersioning(ctx, accountID, bucket, storage.VersioningStatusEnabled)
}

// SuspendVersioning suspends version tracking for new uploads.
func (s *BucketConfigService) SuspendVersioning(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketVersioning); err != nil {
		return err
	}
	return s.updateVersioning(ctx, accountID, bucket, storage.VersioningStatusSuspended)
}

func (s *BucketConfigService) updateVersioning(ctx context.Context, accountID, bucket string, status storage.BucketVersioningStatus) error {
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket().PutBucketVersioning(ctx, strings.TrimSpace(bucket), status)
	if err != nil {
		return fmt.Errorf("update bucket versioning: %w", err)
	}
	return nil
}
