package config

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"can/internal/providers"
)

// GetBucketACL returns the normalized ACL for the given bucket.
func (s *BucketConfigService) GetBucketACL(ctx context.Context, accountID, bucket string) (*BucketACL, error) {
	client, _, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	result, err := client.Buckets().GetBucketACL(ctx, bucket)
	if err != nil {
		return nil, err
	}
	return mapProviderACL(result), nil
}

// SetBucketACL applies either a canned ACL or a custom grant list.
func (s *BucketConfigService) SetBucketACL(ctx context.Context, accountID, bucket string, acl *BucketACL) error {
	if acl == nil {
		return errors.New("acl payload is required")
	}
	client, _, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	input := providers.BucketACLInput{
		OwnerID: acl.OwnerID,
		Canned:  strings.TrimSpace(acl.Canned),
		Grants:  mapConfigGrants(acl.Grants),
	}
	return client.Buckets().PutBucketACL(ctx, bucket, input)
}

// GetPublicAccessBlock retrieves the AWS style block public access configuration.
func (s *BucketConfigService) GetPublicAccessBlock(ctx context.Context, accountID, bucket string) (*PublicAccessBlock, error) {
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	block, err := client.Buckets().GetPublicAccessBlock(ctx, bucket)
	if err != nil {
		if errors.Is(err, providers.ErrUnsupportedCapability) {
			return nil, fmt.Errorf("%s 不支持阻止公共访问", creds.Provider.Label())
		}
		return nil, err
	}
	return mapProviderPAB(block), nil
}

// SetPublicAccessBlock updates the block public access switches.
func (s *BucketConfigService) SetPublicAccessBlock(ctx context.Context, accountID, bucket string, cfg *PublicAccessBlock) error {
	if cfg == nil {
		return errors.New("configuration is required")
	}
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Buckets().PutPublicAccessBlock(ctx, bucket, providers.PublicAccessBlock{
		BlockPublicAcls:       cfg.BlockPublicAcls,
		IgnorePublicAcls:      cfg.IgnorePublicAcls,
		BlockPublicPolicy:     cfg.BlockPublicPolicy,
		RestrictPublicBuckets: cfg.RestrictPublicBuckets,
	})
	if errors.Is(err, providers.ErrUnsupportedCapability) {
		return fmt.Errorf("%s 不支持阻止公共访问", creds.Provider.Label())
	}
	return err
}

// GetBucketReferer fetches the referer whitelist configuration.
func (s *BucketConfigService) GetBucketReferer(ctx context.Context, accountID, bucket string) (*BucketReferer, error) {
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return nil, err
	}
	referer, err := client.Buckets().GetBucketReferer(ctx, bucket)
	if err != nil {
		if errors.Is(err, providers.ErrUnsupportedCapability) {
			return nil, fmt.Errorf("%s 不支持 Referer 白名单", creds.Provider.Label())
		}
		return nil, err
	}
	return mapProviderReferer(referer), nil
}

// SetBucketReferer updates the referer whitelist configuration.
func (s *BucketConfigService) SetBucketReferer(ctx context.Context, accountID, bucket string, referer *BucketReferer) error {
	if referer == nil {
		return errors.New("referer payload is required")
	}
	client, creds, err := s.storageClient(ctx, accountID, bucket)
	if err != nil {
		return err
	}
	err = client.Buckets().PutBucketReferer(ctx, bucket, providers.BucketReferer{
		Enabled:    referer.Enabled,
		AllowEmpty: referer.AllowEmpty,
		Whitelist:  append([]string(nil), referer.Whitelist...),
		Mode:       referer.Mode,
	})
	if errors.Is(err, providers.ErrUnsupportedCapability) {
		return fmt.Errorf("%s 不支持 Referer 白名单", creds.Provider.Label())
	}
	return err
}

func mapProviderACL(model providers.BucketACL) *BucketACL {
	return &BucketACL{
		OwnerID:          model.OwnerID,
		OwnerDisplayName: model.OwnerDisplayName,
		Canned:           model.Canned,
		Grants:           mapProviderGrants(model.Grants),
		Updated:          time.Now(),
	}
}

func mapProviderGrants(grants []providers.AccessGrant) []ACLGrant {
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

func mapConfigGrants(grants []ACLGrant) []providers.AccessGrant {
	if len(grants) == 0 {
		return nil
	}
	out := make([]providers.AccessGrant, 0, len(grants))
	for _, grant := range grants {
		out = append(out, providers.AccessGrant{
			GranteeType: grant.GranteeType,
			Grantee:     grant.Grantee,
			Permission:  grant.Permission,
			DisplayName: grant.DisplayName,
			URI:         grant.URI,
		})
	}
	return out
}

func mapProviderPAB(block providers.PublicAccessBlock) *PublicAccessBlock {
	return &PublicAccessBlock{
		BlockPublicAcls:       block.BlockPublicAcls,
		IgnorePublicAcls:      block.IgnorePublicAcls,
		BlockPublicPolicy:     block.BlockPublicPolicy,
		RestrictPublicBuckets: block.RestrictPublicBuckets,
		Updated:               time.Now(),
	}
}

func mapProviderReferer(referer providers.BucketReferer) *BucketReferer {
	return &BucketReferer{
		Enabled:    referer.Enabled,
		AllowEmpty: referer.AllowEmpty,
		Whitelist:  append([]string(nil), referer.Whitelist...),
		Mode:       referer.Mode,
		Updated:    time.Now(),
	}
}
