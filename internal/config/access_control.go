package config

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"can/internal/storage"
	"can/internal/types"
)

// GetBucketACL returns the normalized ACL for the given bucket.
func (s *BucketConfigService) GetBucketACL(ctx context.Context, accountID, bucket string) (*BucketACL, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketACL); err != nil {
		return nil, err
	}
	client, _, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	result, err := client.Bucket().GetBucketACL(ctx, bucket)
	if err != nil {
		return nil, err
	}
	return mapProviderACL(result), nil
}

// SetBucketACL applies either a canned ACL or a custom grant list.
func (s *BucketConfigService) SetBucketACL(ctx context.Context, accountID, bucket string, acl *BucketACL) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketACL); err != nil {
		return err
	}
	if acl == nil {
		return errors.New("acl payload is required")
	}
	client, _, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	input := storage.BucketACLInput{
		OwnerID: acl.OwnerID,
		Canned:  strings.TrimSpace(acl.Canned),
		Grants:  mapConfigGrants(acl.Grants),
	}
	return client.Bucket().PutBucketACL(ctx, bucket, input)
}

// GetPublicAccessBlock retrieves the AWS style block public access configuration.
func (s *BucketConfigService) GetPublicAccessBlock(ctx context.Context, accountID, bucket string) (*PublicAccessBlock, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPublicAccess); err != nil {
		return nil, err
	}
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	block, err := client.Bucket().GetPublicAccessBlock(ctx, bucket)
	if err != nil {
		if errors.Is(err, storage.ErrUnsupportedCapability) {
			return nil, fmt.Errorf("%s 不支持阻止公共访问", creds.Provider.Label())
		}
		return nil, err
	}
	return mapProviderPAB(block), nil
}

// SetPublicAccessBlock updates the block public access switches.
func (s *BucketConfigService) SetPublicAccessBlock(ctx context.Context, accountID, bucket string, cfg *PublicAccessBlock) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketPublicAccess); err != nil {
		return err
	}
	if cfg == nil {
		return errors.New("configuration is required")
	}
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket().PutPublicAccessBlock(ctx, bucket, storage.PublicAccessBlock{
		BlockPublicAcls:       cfg.BlockPublicAcls,
		IgnorePublicAcls:      cfg.IgnorePublicAcls,
		BlockPublicPolicy:     cfg.BlockPublicPolicy,
		RestrictPublicBuckets: cfg.RestrictPublicBuckets,
	})
	if errors.Is(err, storage.ErrUnsupportedCapability) {
		return fmt.Errorf("%s 不支持阻止公共访问", creds.Provider.Label())
	}
	return err
}

// GetBucketReferer fetches the referer whitelist configuration.
func (s *BucketConfigService) GetBucketReferer(ctx context.Context, accountID, bucket string) (*BucketReferer, error) {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketReferer); err != nil {
		return nil, err
	}
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	referer, err := client.Bucket().GetBucketReferer(ctx, bucket)
	if err != nil {
		if errors.Is(err, storage.ErrUnsupportedCapability) {
			return nil, fmt.Errorf("%s 不支持 Referer 白名单", creds.Provider.Label())
		}
		return nil, err
	}
	return mapProviderReferer(referer), nil
}

// SetBucketReferer updates the referer whitelist configuration.
func (s *BucketConfigService) SetBucketReferer(ctx context.Context, accountID, bucket string, referer *BucketReferer) error {
	if err := s.ensureCapability(ctx, accountID, types.FeatureBucketReferer); err != nil {
		return err
	}
	if referer == nil {
		return errors.New("referer payload is required")
	}
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Bucket().PutBucketReferer(ctx, bucket, storage.BucketReferer{
		Enabled:    referer.Enabled,
		AllowEmpty: referer.AllowEmpty,
		Whitelist:  append([]string(nil), referer.Whitelist...),
		Mode:       referer.Mode,
	})
	if errors.Is(err, storage.ErrUnsupportedCapability) {
		return fmt.Errorf("%s 不支持 Referer 白名单", creds.Provider.Label())
	}
	return err
}

func mapProviderACL(model storage.BucketACL) *BucketACL {
	return &BucketACL{
		OwnerID:          model.OwnerID,
		OwnerDisplayName: model.OwnerDisplayName,
		Canned:           model.Canned,
		Grants:           mapProviderGrants(model.Grants),
		Updated:          time.Now(),
	}
}

func mapProviderGrants(grants []storage.AccessGrant) []ACLGrant {
	if len(grants) == 0 {
		return nil
	}
	out := make([]ACLGrant, 0, len(grants))
	for _, grant := range grants {
		out = append(out, ACLGrant{
			GranteeType: grant.GranteeType,
			Grantee:     grant.Grantee,
			Permission:  grant.Permission,
			DisplayName: grant.DisplayName,
			URI:         grant.URI,
		})
	}
	return out
}

func mapConfigGrants(grants []ACLGrant) []storage.AccessGrant {
	if len(grants) == 0 {
		return nil
	}
	out := make([]storage.AccessGrant, 0, len(grants))
	for _, grant := range grants {
		out = append(out, storage.AccessGrant{
			GranteeType: grant.GranteeType,
			Grantee:     grant.Grantee,
			Permission:  grant.Permission,
			DisplayName: grant.DisplayName,
			URI:         grant.URI,
		})
	}
	return out
}

func mapProviderPAB(block storage.PublicAccessBlock) *PublicAccessBlock {
	return &PublicAccessBlock{
		BlockPublicAcls:       block.BlockPublicAcls,
		IgnorePublicAcls:      block.IgnorePublicAcls,
		BlockPublicPolicy:     block.BlockPublicPolicy,
		RestrictPublicBuckets: block.RestrictPublicBuckets,
		Updated:               time.Now(),
	}
}

func mapProviderReferer(referer storage.BucketReferer) *BucketReferer {
	return &BucketReferer{
		Enabled:    referer.Enabled,
		AllowEmpty: referer.AllowEmpty,
		Whitelist:  append([]string(nil), referer.Whitelist...),
		Mode:       referer.Mode,
		Updated:    time.Now(),
	}
}
