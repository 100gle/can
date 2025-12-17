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

// GetWebsite returns the static website configuration.
func (s *BucketConfigService) GetWebsite(ctx context.Context, accountID, bucket string) (*BucketWebsite, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketWebsite); err != nil {
		return nil, err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	config, err := client.Bucket.GetBucketWebsite(ctx, strings.TrimSpace(bucket))
	if err != nil {
		var apiErr smithy.APIError
		if errors.As(err, &apiErr) && apiErr.ErrorCode() == "NoSuchWebsiteConfiguration" {
			return &BucketWebsite{Enabled: false}, nil
		}
		return nil, fmt.Errorf("get bucket website: %w", err)
	}
	if config == nil {
		return &BucketWebsite{Enabled: false}, nil
	}
	indexKey := ""
	errorKey := ""
	if config.IndexDocument != nil {
		indexKey = config.IndexDocument.Suffix
	}
	if config.ErrorDocument != nil {
		errorKey = config.ErrorDocument.Key
	}
	return &BucketWebsite{
		Enabled:  true,
		IndexKey: indexKey,
		ErrorKey: errorKey,
	}, nil
}

// SetWebsite configures static website hosting. Passing a nil or disabled value clears the configuration.
func (s *BucketConfigService) SetWebsite(ctx context.Context, accountID, bucket string, website *BucketWebsite) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketWebsite); err != nil {
		return err
	}
	client, err := s.client(ctx, accountID, bucket)
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
	config := storage.BucketWebsiteConfiguration{
		IndexDocument: &storage.IndexDocument{Suffix: indexKey},
	}
	if errorKey := strings.TrimSpace(website.ErrorKey); errorKey != "" {
		config.ErrorDocument = &storage.ErrorDocument{Key: errorKey}
	}
	err = client.Bucket.PutBucketWebsite(ctx, strings.TrimSpace(bucket), config)
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
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket.DeleteBucketWebsite(ctx, strings.TrimSpace(bucket))
	if err != nil {
		return fmt.Errorf("delete bucket website: %w", err)
	}
	return nil
}
