package config

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"can/internal/types"

	"github.com/aws/smithy-go"
)

// GetPolicy returns the bucket access policy if any.
func (s *BucketConfigService) GetPolicy(ctx context.Context, accountID, bucket string) (*BucketPolicy, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPolicy); err != nil {
		return nil, err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	raw, err := client.Buckets().GetBucketPolicy(ctx, strings.TrimSpace(bucket))
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchBucketPolicy" {
			return &BucketPolicy{}, nil
		}
		// Also check for empty policy which might be returned as error by some providers?
		// But let's assume storage package handles it.
		return nil, fmt.Errorf("get bucket policy: %w", err)
	}
	if strings.TrimSpace(raw) == "" {
		return &BucketPolicy{}, nil
	}
	var decoded BucketPolicy
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		decoded = BucketPolicy{}
	}
	decoded.Raw = raw
	return &decoded, nil
}

// SetPolicy replaces the bucket policy. Passing nil clears the policy.
func (s *BucketConfigService) SetPolicy(ctx context.Context, accountID, bucket string, policy *BucketPolicy) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPolicy); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if policy == nil || (strings.TrimSpace(policy.Raw) == "" && len(policy.Statement) == 0) {
		return s.DeletePolicy(ctx, accountID, bucket)
	}
	payload := strings.TrimSpace(policy.Raw)
	if payload == "" {
		body := map[string]any{
			"Version":   policy.VersionOrDefault(),
			"Statement": policy.Statement,
		}
		blob, marshalErr := json.Marshal(body)
		if marshalErr != nil {
			return fmt.Errorf("marshal policy: %w", marshalErr)
		}
		payload = string(blob)
	}
	err = client.Buckets().PutBucketPolicy(ctx, strings.TrimSpace(bucket), payload)
	if err != nil {
		return fmt.Errorf("put bucket policy: %w", err)
	}
	return nil
}

// DeletePolicy removes the bucket policy.
func (s *BucketConfigService) DeletePolicy(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPolicy); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Buckets().DeleteBucketPolicy(ctx, strings.TrimSpace(bucket))
	if err != nil {
		return fmt.Errorf("delete bucket policy: %w", err)
	}
	return nil
}

// VersionOrDefault returns the policy version preferring AWS defaults.
func (p *BucketPolicy) VersionOrDefault() string {
	if strings.TrimSpace(p.Version) == "" {
		return "2012-10-17"
	}
	return p.Version
}
