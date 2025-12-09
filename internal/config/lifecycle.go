package config

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"can/internal/types"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
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
	output, err := client.GetBucketLifecycleConfiguration(ctx, &s3.GetBucketLifecycleConfigurationInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchLifecycleConfiguration" {
			return []*LifecycleRule{}, nil
		}
		return nil, fmt.Errorf("get lifecycle configuration: %w", err)
	}
	if output == nil || len(output.Rules) == 0 {
		return []*LifecycleRule{}, nil
	}
	result := make([]*LifecycleRule, 0, len(output.Rules))
	for _, rule := range output.Rules {
		result = append(result, &LifecycleRule{
			ID:             aws.ToString(rule.ID),
			Prefix:         aws.ToString(rule.Prefix),
			Status:         string(rule.Status),
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
	sdkRules := make([]s3types.LifecycleRule, 0, len(rules))
	for _, rule := range rules {
		if rule == nil {
			continue
		}
		status := s3types.ExpirationStatusDisabled
		switch strings.ToLower(strings.TrimSpace(rule.Status)) {
		case "enabled":
			status = s3types.ExpirationStatusEnabled
		case "disabled":
			status = s3types.ExpirationStatusDisabled
		}
		sdkRule := s3types.LifecycleRule{
			ID:     aws.String(strings.TrimSpace(rule.ID)),
			Prefix: aws.String(strings.TrimSpace(rule.Prefix)),
			Status: status,
		}
		if rule.ExpirationDays > 0 {
			days := int32(rule.ExpirationDays)
			sdkRule.Expiration = &s3types.LifecycleExpiration{
				Days: aws.Int32(days),
			}
		}
		if rule.TransitionDays > 0 {
			days := int32(rule.TransitionDays)
			sdkRule.Transitions = []s3types.Transition{
				{
					Days:         aws.Int32(days),
					StorageClass: s3types.TransitionStorageClassStandardIa,
				},
			}
		}
		if rule.NoncurrentDays > 0 {
			days := int32(rule.NoncurrentDays)
			sdkRule.NoncurrentVersionExpiration = &s3types.NoncurrentVersionExpiration{
				NoncurrentDays: aws.Int32(days),
			}
		}
		sdkRules = append(sdkRules, sdkRule)
	}
	if len(sdkRules) == 0 {
		return s.DeleteLifecycle(ctx, accountID, bucket)
	}
	_, err = client.PutBucketLifecycleConfiguration(ctx, &s3.PutBucketLifecycleConfigurationInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
		LifecycleConfiguration: &s3types.BucketLifecycleConfiguration{
			Rules: sdkRules,
		},
	})
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
	_, err = client.DeleteBucketLifecycle(ctx, &s3.DeleteBucketLifecycleInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		return fmt.Errorf("delete lifecycle configuration: %w", err)
	}
	return nil
}

func convertLifecycleDays(expiration *s3types.LifecycleExpiration) int {
	if expiration == nil {
		return 0
	}
	if expiration.Days != nil {
		return int(*expiration.Days)
	}
	return 0
}

func convertNoncurrentDays(expiration *s3types.NoncurrentVersionExpiration) int {
	if expiration == nil {
		return 0
	}
	if expiration.NoncurrentDays == nil {
		return 0
	}
	return int(*expiration.NoncurrentDays)
}

func firstTransitionDays(transitions []s3types.Transition) int {
	if len(transitions) == 0 {
		return 0
	}
	if transitions[0].Days != nil {
		return int(*transitions[0].Days)
	}
	return 0
}
