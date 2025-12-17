package config

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"can/internal/storage"
	"can/internal/types"
)

// GetBucketACL returns the normalized ACL for the given bucket.
func (s *BucketConfigService) GetBucketACL(ctx context.Context, accountID, bucket string) (*storage.BucketACL, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketACL); err != nil {
		return nil, err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	result, err := client.Bucket.GetBucketACL(ctx, bucket)
	if err != nil {
		return nil, err
	}
	// Return storage type directly (BucketACL is now an alias)
	return &result, nil
}

// SetBucketACL applies either a canned ACL or a custom grant list.
func (s *BucketConfigService) SetBucketACL(ctx context.Context, accountID, bucket string, acl *storage.BucketACL) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketACL); err != nil {
		return err
	}
	if acl == nil {
		return errors.New("acl payload is required")
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	input := storage.BucketACLInput{
		OwnerID: acl.OwnerID,
		Canned:  strings.TrimSpace(acl.Canned),
		Grants:  acl.Grants,
	}
	return client.Bucket.PutBucketACL(ctx, bucket, input)
}

// GetPublicAccessBlock retrieves the AWS style block public access configuration.
func (s *BucketConfigService) GetPublicAccessBlock(ctx context.Context, accountID, bucket string) (*storage.PublicAccessBlock, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPublicAccess); err != nil {
		return nil, err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	block, err := client.Bucket.GetPublicAccessBlock(ctx, bucket)
	if err != nil {
		if errors.Is(err, storage.ErrUnsupportedFeature) {
			return nil, fmt.Errorf("%s 不支持阻止公共访问", client.Provider.Label())
		}
		return nil, err
	}
	// Return storage type directly (PublicAccessBlock is now an alias)
	return &block, nil
}

// SetPublicAccessBlock updates the block public access switches.
func (s *BucketConfigService) SetPublicAccessBlock(ctx context.Context, accountID, bucket string, cfg *storage.PublicAccessBlock) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPublicAccess); err != nil {
		return err
	}
	if cfg == nil {
		return errors.New("configuration is required")
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket.PutPublicAccessBlock(ctx, bucket, storage.PublicAccessBlock{
		BlockPublicAcls:       cfg.BlockPublicAcls,
		IgnorePublicAcls:      cfg.IgnorePublicAcls,
		BlockPublicPolicy:     cfg.BlockPublicPolicy,
		RestrictPublicBuckets: cfg.RestrictPublicBuckets,
	})
	if errors.Is(err, storage.ErrUnsupportedFeature) {
		return fmt.Errorf("%s 不支持阻止公共访问", client.Provider.Label())
	}
	return err
}

// GetBucketReferer fetches the referer whitelist configuration.
func (s *BucketConfigService) GetBucketReferer(ctx context.Context, accountID, bucket string) (*storage.BucketReferer, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketReferer); err != nil {
		return nil, err
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	referer, err := client.Bucket.GetBucketReferer(ctx, bucket)
	if err != nil {
		if errors.Is(err, storage.ErrUnsupportedFeature) {
			return nil, fmt.Errorf("%s 不支持 Referer 白名单", client.Provider.Label())
		}
		return nil, err
	}
	// Return storage type directly (BucketReferer is now an alias)
	return &referer, nil
}

// SetBucketReferer updates the referer whitelist configuration.
func (s *BucketConfigService) SetBucketReferer(ctx context.Context, accountID, bucket string, referer *storage.BucketReferer) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketReferer); err != nil {
		return err
	}
	if referer == nil {
		return errors.New("referer payload is required")
	}
	client, err := s.client(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket.PutBucketReferer(ctx, bucket, storage.BucketReferer{
		Enabled:    referer.Enabled,
		AllowEmpty: referer.AllowEmpty,
		Whitelist:  append([]string(nil), referer.Whitelist...),
		Mode:       referer.Mode,
	})
	if errors.Is(err, storage.ErrUnsupportedFeature) {
		return fmt.Errorf("%s 不支持 Referer 白名单", client.Provider.Label())
	}
	return err
}
