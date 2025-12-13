package config

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"can/internal/storage"
	"can/internal/types"

	"github.com/aws/smithy-go"
)

// GetLifecycle loads lifecycle rules for the bucket.
func (s *BucketConfigService) GetLifecycle(ctx context.Context, accountID, bucket string) ([]*LifecycleRule, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketLifecycle); err != nil {
		return nil, err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	rules, err := client.Bucket().GetBucketLifecycleConfiguration(ctx, strings.TrimSpace(bucket))
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchLifecycleConfiguration" {
			return []*LifecycleRule{}, nil
		}
		return nil, fmt.Errorf("get lifecycle configuration: %w", err)
	}
	if len(rules) == 0 {
		return []*LifecycleRule{}, nil
	}
	result := make([]*LifecycleRule, 0, len(rules))
	for _, rule := range rules {
		result = append(result, &LifecycleRule{
			ID:             rule.ID,
			Prefix:         rule.Prefix,
			Status:         rule.Status,
			ExpirationDays: convertLifecycleDays(rule.Expiration),
			TransitionDays: firstTransitionDays(rule.Transitions),
			NoncurrentDays: convertNoncurrentDays(rule.NoncurrentVersionExpiration),
		})
	}
	return result, nil
}

// SetLifecycle replaces the bucket lifecycle configuration.
func (s *BucketConfigService) SetLifecycle(ctx context.Context, accountID, bucket string, rules []*LifecycleRule) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketLifecycle); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if len(rules) == 0 {
		return s.DeleteLifecycle(ctx, accountID, bucket)
	}
	storageRules := make([]storage.LifecycleRule, 0, len(rules))
	for _, rule := range rules {
		if rule == nil {
			continue
		}
		status := "Disabled"
		if strings.ToLower(strings.TrimSpace(rule.Status)) == "enabled" {
			status = "Enabled"
		}

		storageRule := storage.LifecycleRule{
			ID:     strings.TrimSpace(rule.ID),
			Prefix: strings.TrimSpace(rule.Prefix),
			Status: status,
		}
		if rule.ExpirationDays > 0 {
			days := int32(rule.ExpirationDays)
			storageRule.Expiration = &storage.LifecycleExpiration{
				Days: &days,
			}
		}
		if rule.TransitionDays > 0 {
			days := int32(rule.TransitionDays)
			storageRule.Transitions = []storage.LifecycleTransition{
				{
					Days:         &days,
					StorageClass: "STANDARD_IA",
				},
			}
		}
		if rule.NoncurrentDays > 0 {
			days := int32(rule.NoncurrentDays)
			storageRule.NoncurrentVersionExpiration = &storage.NoncurrentVersionExpiration{
				NoncurrentDays: &days,
			}
		}
		storageRules = append(storageRules, storageRule)
	}
	if len(storageRules) == 0 {
		return s.DeleteLifecycle(ctx, accountID, bucket)
	}
	err = client.Bucket().PutBucketLifecycleConfiguration(ctx, strings.TrimSpace(bucket), storageRules)
	if err != nil {
		return fmt.Errorf("put lifecycle configuration: %w", err)
	}
	return nil
}

// DeleteLifecycle removes all lifecycle rules for the bucket.
func (s *BucketConfigService) DeleteLifecycle(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketLifecycle); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket().DeleteBucketLifecycle(ctx, strings.TrimSpace(bucket))
	if err != nil {
		return fmt.Errorf("delete lifecycle configuration: %w", err)
	}
	return nil
}

func convertLifecycleDays(expiration *storage.LifecycleExpiration) int {
	if expiration == nil {
		return 0
	}
	if expiration.Days != nil {
		return int(*expiration.Days)
	}
	return 0
}

func convertNoncurrentDays(expiration *storage.NoncurrentVersionExpiration) int {
	if expiration == nil {
		return 0
	}
	if expiration.NoncurrentDays == nil {
		return 0
	}
	return int(*expiration.NoncurrentDays)
}

func firstTransitionDays(transitions []storage.LifecycleTransition) int {
	if len(transitions) == 0 {
		return 0
	}
	if transitions[0].Days != nil {
		return int(*transitions[0].Days)
	}
	return 0
}
