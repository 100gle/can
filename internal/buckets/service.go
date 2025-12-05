package buckets

import (
	"context"
	"errors"
	"sort"
	"strings"

	"can/internal/accounts"
	"can/internal/providers"
)

// Service orchestrates bucket level operations via the shared S3 factory.
type Service struct {
	accounts *accounts.Service
	pool     providers.ClientPool
}

// NewService wires the dependencies required to manage buckets.
func NewService(accounts *accounts.Service, pool providers.ClientPool) *Service {
	return &Service{accounts: accounts, pool: pool}
}

// ListBuckets enumerates all buckets accessible by the account credentials.
func (s *Service) ListBuckets(ctx context.Context, accountID string) ([]BucketInfo, error) {
	client, creds, err := s.client(ctx, accountID)
	if err != nil {
		return nil, err
	}
	descriptors, err := client.Buckets().ListBuckets(ctx)
	if err != nil {
		return nil, err
	}
	items := make([]BucketInfo, 0, len(descriptors))
	for _, descriptor := range descriptors {
		if strings.TrimSpace(descriptor.Region) == "" {
			descriptor.Region = creds.Region
		}
		items = append(items, BucketInfo{
			Name:        descriptor.Name,
			CreatedAt:   descriptor.CreatedAt,
			Region:      descriptor.Region,
			ObjectCount: descriptor.ObjectCount,
			Size:        descriptor.Size,
		})
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].Name < items[j].Name
	})
	return items, nil
}

// CreateBucket provisions a new bucket in the desired region.
func (s *Service) CreateBucket(ctx context.Context, accountID, name, region string) error {
	client, creds, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	region = strings.TrimSpace(region)
	if region == "" {
		region = creds.Region
	}
	return client.Buckets().CreateBucket(ctx, bucketName, region)
}

// DeleteBucket removes the specified bucket. Caller must ensure it's empty.
func (s *Service) DeleteBucket(ctx context.Context, accountID, name string) error {
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	return client.Buckets().DeleteBucket(ctx, bucketName)
}

// HeadBucket checks whether the bucket exists and is accessible.
func (s *Service) HeadBucket(ctx context.Context, accountID, name string) error {
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return err
	}
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	return client.Buckets().HeadBucket(ctx, bucketName)
}

// BucketLocation returns the resolved region for a bucket.
func (s *Service) BucketLocation(ctx context.Context, accountID, name string) (string, error) {
	client, _, err := s.client(ctx, accountID)
	if err != nil {
		return "", err
	}
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return "", errors.New("bucket name is required")
	}
	return client.Buckets().BucketLocation(ctx, bucketName)
}

func (s *Service) client(ctx context.Context, accountID string) (providers.StorageClient, providers.ConnectionCredentials, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, providers.ConnectionCredentials{}, errors.New("account id is required")
	}
	if s.pool == nil {
		return nil, providers.ConnectionCredentials{}, errors.New("storage client pool not configured")
	}
	supplier := func(ctx context.Context) (providers.ConnectionCredentials, error) {
		return s.accounts.ConnectionCredentials(ctx, accountID)
	}
	client, creds, err := s.pool.Get(ctx, accountID, supplier)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	return client, creds, nil
}
