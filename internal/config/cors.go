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

// GetCORS returns the current bucket CORS rules.
func (s *BucketConfigService) GetCORS(ctx context.Context, accountID, bucket string) (*BucketCORS, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketCORS); err != nil {
		return nil, err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	output, err := client.GetBucketCors(ctx, &s3.GetBucketCorsInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchCORSConfiguration" {
			return &BucketCORS{}, nil
		}
		return nil, fmt.Errorf("get bucket cors: %w", err)
	}
	result := &BucketCORS{}
	for _, rule := range output.CORSRules {
		result.Rules = append(result.Rules, CORSRule{
			AllowedOrigins: append([]string{}, rule.AllowedOrigins...),
			AllowedMethods: append([]string{}, rule.AllowedMethods...),
			AllowedHeaders: append([]string{}, rule.AllowedHeaders...),
			ExposeHeaders:  append([]string{}, rule.ExposeHeaders...),
			MaxAgeSeconds:  aws.ToInt32(rule.MaxAgeSeconds),
		})
	}
	return result, nil
}

// SetCORS replaces the bucket CORS configuration.
func (s *BucketConfigService) SetCORS(ctx context.Context, accountID, bucket string, cors *BucketCORS) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketCORS); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if cors == nil || len(cors.Rules) == 0 {
		return s.DeleteCORS(ctx, accountID, bucket)
	}
	rules := make([]s3types.CORSRule, 0, len(cors.Rules))
	for _, rule := range cors.Rules {
		rules = append(rules, s3types.CORSRule{
			AllowedOrigins: append([]string{}, rule.AllowedOrigins...),
			AllowedMethods: append([]string{}, rule.AllowedMethods...),
			AllowedHeaders: append([]string{}, rule.AllowedHeaders...),
			ExposeHeaders:  append([]string{}, rule.ExposeHeaders...),
			MaxAgeSeconds:  aws.Int32(rule.MaxAgeSeconds),
		})
	}
	_, err = client.PutBucketCors(ctx, &s3.PutBucketCorsInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
		CORSConfiguration: &s3types.CORSConfiguration{
			CORSRules: rules,
		},
	})
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
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	_, err = client.DeleteBucketCors(ctx, &s3.DeleteBucketCorsInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		return fmt.Errorf("delete bucket cors: %w", err)
	}
	return nil
}
