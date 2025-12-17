package buckets

import (
	"context"
	"errors"
	"sort"
	"strings"

	"can/internal/accounts"
	"can/internal/storage"

	"github.com/rs/zerolog/log"

	"can/internal/validation"
)

// Service orchestrates bucket level operations via the shared S3 factory.
type Service struct {
	accounts *accounts.Service
	vault    *storage.ClientVault
}

// NewService wires the dependencies required to manage buckets.
func NewService(accounts *accounts.Service, vault *storage.ClientVault) *Service {
	return &Service{accounts: accounts, vault: vault}
}

// ListBuckets enumerates all buckets accessible by the account credentials.
func (s *Service) ListBuckets(ctx context.Context, accountID string) ([]storage.BucketDescriptor, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return nil, err
	}
	buckets, err := client.Bucket.ListBuckets(ctx)
	if err != nil {
		return nil, err
	}
	// Backfill empty regions with the client's default region
	for i := range buckets {
		if strings.TrimSpace(buckets[i].Region) == "" {
			buckets[i].Region = client.Region
		}
	}
	sort.Slice(buckets, func(i, j int) bool {
		return buckets[i].Name < buckets[j].Name
	})
	return buckets, nil
}

// CreateBucket provisions a new bucket in the desired region with optional features.
func (s *Service) CreateBucket(ctx context.Context, accountID string, input storage.BucketCreateInput) error {
	if err := validation.ValidateStruct(input); err != nil {
		return err
	}

	logger := log.With().
		Str("component", "buckets.CreateBucket").
		Str("bucket", input.Name).
		Str("region", input.Region).
		Str("provider", "").
		Logger()

	logger.Info().
		Str("acl", string(input.ACL)).
		Bool("cosMultiAZ", input.COSMultiAZ).
		Msg("Creating bucket")

	client, err := s.client(ctx, accountID)
	if err != nil {
		logger.Error().Err(err).Msg("Failed to get client")
		return err
	}
	logger = logger.With().Str("provider", string(client.Provider)).Logger()

	// Validate bucket name according to provider rules
	if err := storage.ValidateBucketName(client.Provider, input.Name); err != nil {
		logger.Error().Err(err).Msg("Invalid bucket name")
		return err
	}

	// Apply default region from client if not specified
	if input.Region == "" {
		input.Region = client.Region
		logger.Info().Str("defaultRegion", client.Region).Msg("Using default region from client")
	}

	// For COS, automatically append AppID to bucket name if not already present
	if client.Provider == "cos" {
		creds, err := s.accounts.Credentials(ctx, accountID)
		if err != nil {
			logger.Error().Err(err).Msg("Failed to get credentials for AppID")
			return err
		}
		appID := creds.GetAppID()
		if appID == "" {
			logger.Error().Msg("COS account requires AppID for bucket creation")
			return errors.New("腾讯云 COS 创建存储桶需要配置 AppID，请在账户设置中填写")
		}
		if !strings.HasSuffix(input.Name, "-"+appID) {
			originalName := input.Name
			input.Name = input.Name + "-" + appID
			logger.Info().
				Str("originalName", originalName).
				Str("newName", input.Name).
				Str("appId", appID).
				Msg("Appended AppID to bucket name")
		}
	}

	if err := client.Bucket.CreateBucket(ctx, input); err != nil {
		logger.Error().Err(err).Msg("CreateBucket API call failed")
		return err
	}

	logger.Info().Msg("Bucket created successfully")
	return nil
}

// DeleteBucket removes the specified bucket. Caller must ensure it's empty.
func (s *Service) DeleteBucket(ctx context.Context, accountID, name string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	return client.Bucket.DeleteBucket(ctx, name)
}

// HeadBucket checks whether the bucket exists and is accessible.
func (s *Service) HeadBucket(ctx context.Context, accountID, name string) error {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	return client.Bucket.HeadBucket(ctx, name)
}

// BucketLocation returns the resolved region for a bucket.
func (s *Service) BucketLocation(ctx context.Context, accountID, name string) (string, error) {
	client, err := s.client(ctx, accountID)
	if err != nil {
		return "", err
	}
	return client.Bucket.BucketLocation(ctx, name)
}

func (s *Service) client(ctx context.Context, accountID string) (*storage.Client, error) {
	return s.accounts.GetClient(ctx, s.vault, accountID)
}
