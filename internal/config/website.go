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

// GetWebsite returns the static website configuration.
func (s *BucketConfigService) GetWebsite(ctx context.Context, accountID, bucket string) (*BucketWebsite, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketWebsite); err != nil {
		return nil, err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	output, err := client.GetBucketWebsite(ctx, &s3.GetBucketWebsiteInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchWebsiteConfiguration" {
			return &BucketWebsite{Enabled: false}, nil
		}
		return nil, fmt.Errorf("get bucket website: %w", err)
	}
	return &BucketWebsite{
		Enabled:  true,
		IndexKey: aws.ToString(output.IndexDocument.Suffix),
		ErrorKey: aws.ToString(output.ErrorDocument.Key),
	}, nil
}

// SetWebsite configures static website hosting. Passing a nil or disabled value clears the configuration.
func (s *BucketConfigService) SetWebsite(ctx context.Context, accountID, bucket string, website *BucketWebsite) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketWebsite); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	if website == nil || !website.Enabled {
		return s.DeleteWebsite(ctx, accountID, bucket)
	}
	indexKey := strings.TrimSpace(website.IndexKey)
	if indexKey == "" {
		return errors.New("index document key is required when enabling website hosting")
	}
	input := &s3.PutBucketWebsiteInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
		WebsiteConfiguration: &s3types.WebsiteConfiguration{
			IndexDocument: &s3types.IndexDocument{Suffix: aws.String(indexKey)},
		},
	}
	if errorKey := strings.TrimSpace(website.ErrorKey); errorKey != "" {
		input.WebsiteConfiguration.ErrorDocument = &s3types.ErrorDocument{Key: aws.String(errorKey)}
	}
	_, err = client.PutBucketWebsite(ctx, input)
	if err != nil {
		return fmt.Errorf("put bucket website: %w", err)
	}
	return nil
}

// DeleteWebsite removes website hosting configuration.
func (s *BucketConfigService) DeleteWebsite(ctx context.Context, accountID, bucket string) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketWebsite); err != nil {
		return err
	}
	client, _, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	_, err = client.DeleteBucketWebsite(ctx, &s3.DeleteBucketWebsiteInput{
		Bucket: aws.String(strings.TrimSpace(bucket)),
	})
	if err != nil {
		return fmt.Errorf("delete bucket website: %w", err)
	}
	return nil
}
