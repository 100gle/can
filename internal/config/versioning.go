package config

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

// GetVersioning returns the current bucket versioning status.
func (s *BucketConfigService) GetVersioning(ctx context.Context, accountID, bucket string) (*BucketVersioning, error) {
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	output, err := client.GetBucketVersioning(ctx, &s3.GetBucketVersioningInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		return nil, fmt.Errorf("get bucket versioning: %w", err)
	}
	status := "Disabled"
	if output != nil && output.Status != "" {
		status = string(output.Status)
	}
	return &BucketVersioning{
		Status:  status,
		Updated: time.Now(),
	}, nil
}

// EnableVersioning switches the bucket into Enabled state.
func (s *BucketConfigService) EnableVersioning(ctx context.Context, accountID, bucket string) error {
	return s.updateVersioning(ctx, accountID, bucket, s3types.BucketVersioningStatusEnabled)
}

// SuspendVersioning suspends version tracking for new uploads.
func (s *BucketConfigService) SuspendVersioning(ctx context.Context, accountID, bucket string) error {
	return s.updateVersioning(ctx, accountID, bucket, s3types.BucketVersioningStatusSuspended)
}

func (s *BucketConfigService) updateVersioning(ctx context.Context, accountID, bucket string, status s3types.BucketVersioningStatus) error {
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	_, err = client.PutBucketVersioning(ctx, &s3.PutBucketVersioningInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
		VersioningConfiguration: &s3types.VersioningConfiguration{
			Status: status,
		},
	})
	if err != nil {
		return fmt.Errorf("update bucket versioning: %w", err)
	}
	return nil
}
