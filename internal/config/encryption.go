package config

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"can/internal/types"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
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
	output, err := client.GetBucketEncryption(ctx, &s3.GetBucketEncryptionInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "ServerSideEncryptionConfigurationNotFoundError" {
			return &BucketEncryption{Enabled: false, Updated: time.Now()}, nil
		}
		return nil, fmt.Errorf("get bucket encryption: %w", err)
	}
	if output == nil || output.ServerSideEncryptionConfiguration == nil || len(output.ServerSideEncryptionConfiguration.Rules) == 0 {
		return &BucketEncryption{Enabled: false, Updated: time.Now()}, nil
	}
	rule := output.ServerSideEncryptionConfiguration.Rules[0]
	defaults := rule.ApplyServerSideEncryptionByDefault
	algorithm := ""
	kmsKey := ""
	if defaults != nil {
		algorithm = string(defaults.SSEAlgorithm)
		kmsKey = aws.ToString(defaults.KMSMasterKeyID)
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
	var sseAlgo s3types.ServerSideEncryption
	switch algo {
	case "aes256":
		sseAlgo = s3types.ServerSideEncryptionAes256
	case "aws:kms":
		sseAlgo = s3types.ServerSideEncryptionAwsKms
	case "aws:kms:dsse":
		sseAlgo = s3types.ServerSideEncryptionAwsKmsDsse
	default:
		return fmt.Errorf("unsupported encryption algorithm %q", encryption.Algorithm)
	}
	if (sseAlgo == s3types.ServerSideEncryptionAwsKms || sseAlgo == s3types.ServerSideEncryptionAwsKmsDsse) && strings.TrimSpace(encryption.KmsKeyID) == "" {
		return errors.New("kms key id is required for aws:kms encryption")
	}
	defaultRule := &s3types.ServerSideEncryptionByDefault{
		SSEAlgorithm: sseAlgo,
	}
	kmsKey := strings.TrimSpace(encryption.KmsKeyID)
	if kmsKey != "" {
		defaultRule.KMSMasterKeyID = aws.String(kmsKey)
	}
	_, err = client.PutBucketEncryption(ctx, &s3.PutBucketEncryptionInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
		ServerSideEncryptionConfiguration: &s3types.ServerSideEncryptionConfiguration{
			Rules: []s3types.ServerSideEncryptionRule{
				{
					ApplyServerSideEncryptionByDefault: defaultRule,
				},
			},
		},
	})
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
	_, err = client.DeleteBucketEncryption(ctx, &s3.DeleteBucketEncryptionInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		return fmt.Errorf("delete bucket encryption: %w", err)
	}
	return nil
}
