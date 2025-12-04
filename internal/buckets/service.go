package buckets

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/types"
)

// Service orchestrates bucket level operations via the shared S3 factory.
type Service struct {
	accounts *accounts.Service
	factory  providers.S3ClientFactory
}

// NewService wires the dependencies required to manage buckets.
func NewService(accounts *accounts.Service, factory providers.S3ClientFactory) *Service {
	return &Service{accounts: accounts, factory: factory}
}

// ListBuckets enumerates all buckets accessible by the account credentials.
func (s *Service) ListBuckets(ctx context.Context, accountID string) ([]BucketInfo, error) {
	client, creds, err := s.client(ctx, accountID)
	if err != nil {
		return nil, err
	}
	out, err := client.ListBuckets(ctx, &s3.ListBucketsInput{})
	if err != nil {
		return nil, providers.WrapS3Error("获取 Bucket 列表", err)
	}
	items := make([]BucketInfo, 0, len(out.Buckets))
	for _, bucket := range out.Buckets {
		name := aws.ToString(bucket.Name)
		region := creds.Region
		if loc, locErr := s.lookupBucketRegion(ctx, client, name); locErr == nil && loc != "" {
			region = loc
		}
		items = append(items, BucketInfo{
			Name:        name,
			CreatedAt:   aws.ToTime(bucket.CreationDate),
			Region:      region,
			ObjectCount: -1,
			Size:        -1,
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
	input := &s3.CreateBucketInput{Bucket: aws.String(bucketName)}
	if shouldIncludeLocationConstraint(creds.Provider, region) {
		input.CreateBucketConfiguration = &s3types.CreateBucketConfiguration{LocationConstraint: s3types.BucketLocationConstraint(region)}
	}
	if _, err := client.CreateBucket(ctx, input); err != nil {
		return providers.WrapS3Error("创建存储桶", err)
	}
	return nil
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
	if _, err := client.DeleteBucket(ctx, &s3.DeleteBucketInput{Bucket: aws.String(bucketName)}); err != nil {
		return providers.WrapS3Error("删除存储桶", err)
	}
	return nil
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
	if _, err := client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: aws.String(bucketName)}); err != nil {
		return providers.WrapS3Error("检查存储桶", err)
	}
	return nil
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
	region, err := s.lookupBucketRegion(ctx, client, bucketName)
	if err != nil {
		return "", providers.WrapS3Error("获取存储桶区域", err)
	}
	return region, nil
}

func (s *Service) client(ctx context.Context, accountID string) (providers.S3Client, providers.ConnectionCredentials, error) {
	if strings.TrimSpace(accountID) == "" {
		return nil, providers.ConnectionCredentials{}, errors.New("account id is required")
	}
	creds, err := s.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	client, err := s.factory.NewClient(ctx, creds)
	if err != nil {
		return nil, providers.ConnectionCredentials{}, err
	}
	return client, creds, nil
}

func (s *Service) lookupBucketRegion(ctx context.Context, client providers.S3Client, bucket string) (string, error) {
	if bucket == "" {
		return "", errors.New("bucket name is required")
	}
	out, err := client.GetBucketLocation(ctx, &s3.GetBucketLocationInput{Bucket: aws.String(bucket)})
	if err != nil {
		return "", err
	}
	if out == nil || out.LocationConstraint == "" {
		return "us-east-1", nil
	}
	return string(out.LocationConstraint), nil
}

func shouldIncludeLocationConstraint(provider types.Provider, region string) bool {
	if region == "" {
		return false
	}
	if provider == types.ProviderAWS && strings.EqualFold(region, "us-east-1") {
		return false
	}
	return true
}
