package cos

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/tencentyun/cos-go-sdk-v5"

	"can/internal/storage"
	"can/internal/storage/s3"
	"can/internal/types"
)

// NewStorageClient creates a new COS-compatible storage client.
func NewStorageClient(ctx context.Context, creds storage.ConnectionCredentials) (storage.StorageClient, error) {
	// Reuse the generic S3 client but override provider-specific behavior.
	s3Creds := creds
	s3Creds.Provider = types.ProviderCOS
	base, err := s3.NewStorageClient(ctx, s3Creds)
	if err != nil {
		return nil, err
	}

	return &cosAdapter{
		StorageClient: base,
		creds:         creds,
	}, nil
}

type cosAdapter struct {
	storage.StorageClient
	creds storage.ConnectionCredentials
}

func (a *cosAdapter) Provider() types.Provider {
	return types.ProviderCOS
}

func (a *cosAdapter) Capabilities() []types.ProviderCapability {
	return types.ProviderCapabilities(types.ProviderCOS)
}

func (a *cosAdapter) Buckets() storage.BucketDriver {
	return &bucketAdapter{
		BucketDriver: a.StorageClient.Buckets(),
		creds:        a.creds,
	}
}

// bucketAdapter overrides bucket-level operations that require native COS SDKs.
type bucketAdapter struct {
	storage.BucketDriver
	creds storage.ConnectionCredentials
}

func (b *bucketAdapter) buildClient(bucketName, regionHint string) *cos.Client {
	region := strings.TrimSpace(regionHint)
	if region == "" {
		region = strings.TrimSpace(b.creds.Region)
	}
	if region == "" {
		region = "ap-guangzhou"
	}
	bucketURL, _ := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", bucketName, region))
	baseURL := &cos.BaseURL{BucketURL: bucketURL}
	return cos.NewClient(baseURL, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  b.creds.AccessKeyID,
			SecretKey: b.creds.SecretAccessKey,
		},
	})
}

func (b *bucketAdapter) CreateBucket(ctx context.Context, input storage.BucketCreateInput) error {
	if !input.COSMultiAZ {
		return b.BucketDriver.CreateBucket(ctx, input)
	}
	bucketName := strings.TrimSpace(input.Name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	region := strings.TrimSpace(input.Region)
	client := b.buildClient(bucketName, region)
	opt := &cos.BucketPutOptions{
		CreateBucketConfiguration: &cos.CreateBucketConfiguration{
			BucketAZConfig: "MAZ",
		},
	}
	if acl := strings.TrimSpace(input.ACL); acl != "" {
		opt.XCosACL = acl
	}
	if _, err := client.Bucket.Put(ctx, opt); err != nil {
		return err
	}
	return nil
}
