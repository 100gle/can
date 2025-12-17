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

// GetCORS returns the current bucket CORS rules.
func (s *BucketConfigService) GetCORS(ctx context.Context, accountID, bucket string) (*BucketCORS, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketCORS); err != nil {
		return nil, err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	rules, err := client.Bucket.GetBucketCors(ctx, strings.TrimSpace(bucket))
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchCORSConfiguration" {
			return &BucketCORS{}, nil
		}
		return nil, fmt.Errorf("get bucket cors: %w", err)
	}
	result := &BucketCORS{}
	for _, rule := range rules {
		result.Rules = append(result.Rules, storage.CORSRule{
			AllowedOrigins: append([]string{}, rule.AllowedOrigins...),
			AllowedMethods: append([]string{}, rule.AllowedMethods...),
			AllowedHeaders: append([]string{}, rule.AllowedHeaders...),
			ExposeHeaders:  append([]string{}, rule.ExposeHeaders...),
			MaxAgeSeconds:  rule.MaxAgeSeconds,
		})
	}
	return result, nil
}

// SetCORS replaces the bucket CORS configuration.
func (s *BucketConfigService) SetCORS(ctx context.Context, accountID, bucket string, cors *BucketCORS) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketCORS); err != nil {
		return err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if cors == nil || len(cors.Rules) == 0 {
		return s.DeleteCORS(ctx, accountID, bucket)
	}
	rules := make([]storage.CORSRule, 0, len(cors.Rules))
	for _, rule := range cors.Rules {
		rules = append(rules, storage.CORSRule{
			AllowedOrigins: append([]string{}, rule.AllowedOrigins...),
			AllowedMethods: append([]string{}, rule.AllowedMethods...),
			AllowedHeaders: append([]string{}, rule.AllowedHeaders...),
			ExposeHeaders:  append([]string{}, rule.ExposeHeaders...),
			MaxAgeSeconds:  rule.MaxAgeSeconds,
		})
	}
	err = client.Bucket.PutBucketCors(ctx, strings.TrimSpace(bucket), rules)
	if err != nil {
		return fmt.Errorf("put bucket cors: %w", err)
	}
	return nil
}

// DeleteCORS removes all bucket CORS rules.
func (s *BucketConfigService) DeleteCORS(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketCORS); err != nil {
		return err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket.DeleteBucketCors(ctx, strings.TrimSpace(bucket))
	if err != nil {
		return fmt.Errorf("delete bucket cors: %w", err)
	}
	return nil
}
