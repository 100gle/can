package config

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"can/internal/storage"
	"can/internal/types"

	"github.com/aws/smithy-go"
)

// GetEncryption fetches the bucket default encryption configuration.
func (s *BucketConfigService) GetEncryption(ctx context.Context, accountID, bucket string) (*BucketEncryption, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketEncryption); err != nil {
		return nil, err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	config, err := client.Bucket().GetBucketEncryption(ctx, strings.TrimSpace(bucket))
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "ServerSideEncryptionConfigurationNotFoundError" {
			return &BucketEncryption{Enabled: false, Updated: time.Now()}, nil
		}
		return nil, fmt.Errorf("get bucket encryption: %w", err)
	}
	if config == nil || len(config.Rules) == 0 {
		return &BucketEncryption{Enabled: false, Updated: time.Now()}, nil
	}
	rule := config.Rules[0]
	defaults := rule.ApplyServerSideEncryptionByDefault
	algorithm := ""
	kmsKey := ""
	if defaults != nil {
		algorithm = defaults.SSEAlgorithm
		kmsKey = defaults.KMSMasterKeyID
	}
	return &BucketEncryption{
		Enabled:   algorithm != "",
		Algorithm: algorithm,
		KmsKeyID:  kmsKey,
		Updated:   time.Now(),
	}, nil
}

// SetEncryption configures the bucket default encryption. Passing a nil or disabled config removes encryption.
func (s *BucketConfigService) SetEncryption(ctx context.Context, accountID, bucket string, encryption *BucketEncryption) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketEncryption); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if encryption == nil || !encryption.Enabled {
		return s.DeleteEncryption(ctx, accountID, bucket)
	}
	algo := strings.ToLower(strings.TrimSpace(encryption.Algorithm))
	if algo == "" {
		return errors.New("algorithm is required when enabling encryption")
	}
	var sseAlgo string
	switch algo {
	case "aes256":
		sseAlgo = "AES256"
	case "aws:kms":
		sseAlgo = "aws:kms"
	case "aws:kms:dsse":
		sseAlgo = "aws:kms:dsse"
	default:
		return fmt.Errorf("unsupported encryption algorithm %q", encryption.Algorithm)
	}
	if (sseAlgo == "aws:kms" || sseAlgo == "aws:kms:dsse") && strings.TrimSpace(encryption.KmsKeyID) == "" {
		return errors.New("kms key id is required for aws:kms encryption")
	}
	defaultRule := &storage.ServerSideEncryptionByDefault{
		SSEAlgorithm: sseAlgo,
	}
	kmsKey := strings.TrimSpace(encryption.KmsKeyID)
	if kmsKey != "" {
		defaultRule.KMSMasterKeyID = kmsKey
	}

	config := storage.BucketEncryptionConfiguration{
		Rules: []storage.BucketEncryptionRule{
			{
				ApplyServerSideEncryptionByDefault: defaultRule,
			},
		},
	}

	err = client.Bucket().PutBucketEncryption(ctx, strings.TrimSpace(bucket), config)
	if err != nil {
		return fmt.Errorf("put bucket encryption: %w", err)
	}
	return nil
}

// DeleteEncryption removes any bucket default encryption rules.
func (s *BucketConfigService) DeleteEncryption(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketEncryption); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket().DeleteBucketEncryption(ctx, strings.TrimSpace(bucket))
	if err != nil {
		return fmt.Errorf("delete bucket encryption: %w", err)
	}
	return nil
}
