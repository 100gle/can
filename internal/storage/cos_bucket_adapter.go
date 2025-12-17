package storage

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/rs/zerolog/log"

	cosSDK "github.com/tencentyun/cos-go-sdk-v5"
)

// NewBucketAdapter decorates the S3 bucket API with COS-specific features.
func newCOSBucketAdapter(base BucketAdapter, creds Credentials) BucketAdapter {
	return &cosBucketAdapter{
		BucketAdapter: base,
		creds:         creds,
	}
}

type cosBucketAdapter struct {
	BucketAdapter
	creds Credentials
}

func (b *cosBucketAdapter) CreateBucket(ctx context.Context, input BucketCreateInput) error {
	logger := log.With().
		Str("component", "cos.CreateBucket").
		Str("bucket", input.Name).
		Str("region", input.Region).
		Bool("cosMultiAZ", input.COSMultiAZ).
		Logger()

	if !input.COSMultiAZ {
		logger.Info().Msg("Delegating to S3 base adapter (non-MAZ)")
		return b.BucketAdapter.CreateBucket(ctx, input)
	}

	logger.Info().Msg("Creating COS bucket with MAZ configuration")

	bucketName := strings.TrimSpace(input.Name)
	if bucketName == "" {
		logger.Error().Msg("Bucket name is empty")
		return errors.New("bucket name is required")
	}
	region := strings.TrimSpace(input.Region)
	client := b.buildClient(bucketName, region)

	logger.Info().Str("targetURL", fmt.Sprintf("https://%s.cos.%s.myqcloud.com", bucketName, region)).Msg("COS client built")

	opt := &cosSDK.BucketPutOptions{
		CreateBucketConfiguration: &cosSDK.CreateBucketConfiguration{
			BucketAZConfig: "MAZ",
		},
	}
	if acl := strings.TrimSpace(input.ACL); acl != "" {
		opt.XCosACL = acl
		logger.Info().Str("acl", acl).Msg("Setting ACL")
	}

	resp, err := client.Bucket.Put(ctx, opt)
	if err != nil {
		logger.Error().Err(err).Msg("COS Bucket.Put failed")
		return err
	}

	logger.Info().Int("statusCode", resp.StatusCode).Msg("COS bucket created successfully")
	return nil
}

func (b *cosBucketAdapter) GetBucketMAZConfig(ctx context.Context, name string) (*MAZConfiguration, error) {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return nil, errors.New("bucket name is required")
	}
	client := b.buildClient(bucketName, "")
	meta, _, err := client.Bucket.GetMeta(ctx, bucketName)
	if err != nil {
		return nil, err
	}
	status := MAZStatusDisabled
	if meta != nil && meta.MAZ {
		status = MAZStatusEnabled
	}
	return &MAZConfiguration{Status: status}, nil
}

func (b *cosBucketAdapter) EnableBucketMAZ(ctx context.Context, name string) error {
	return ErrUnsupportedFeature
}

func (b *cosBucketAdapter) DisableBucketMAZ(ctx context.Context, name string) error {
	return ErrUnsupportedFeature
}

func (b *cosBucketAdapter) GetBucketReferer(ctx context.Context, name string) (BucketReferer, error) {
	client := b.buildClient(name, "")
	res, _, err := client.Bucket.GetReferer(ctx)
	if err != nil {
		return BucketReferer{}, err
	}

	return BucketReferer{
		Enabled:    res.Status == "Enabled",
		AllowEmpty: res.EmptyReferConfiguration == "Allow",
		Whitelist:  res.DomainList,
		Mode:       res.RefererType, // "Black-List" or "White-List"
	}, nil
}

func (b *cosBucketAdapter) PutBucketReferer(ctx context.Context, name string, referer BucketReferer) error {
	client := b.buildClient(name, "")

	status := "Disabled"
	if referer.Enabled {
		status = "Enabled"
	}

	emptyRef := "Deny"
	if referer.AllowEmpty {
		emptyRef = "Allow"
	}

	refType := referer.Mode
	if referer.Mode == "" {
		refType = "White-List" // Default
	}

	opt := &cosSDK.BucketPutRefererOptions{
		Status:                  status,
		RefererType:             refType,
		DomainList:              referer.Whitelist,
		EmptyReferConfiguration: emptyRef,
	}

	_, err := client.Bucket.PutReferer(ctx, opt)
	return err
}

func (b *cosBucketAdapter) buildClient(bucketName, regionHint string) *cosSDK.Client {
	region := strings.TrimSpace(regionHint)
	if region == "" {
		region = strings.TrimSpace(b.creds.Region)
	}
	if region == "" {
		region = "ap-guangzhou"
	}
	bucketURL, _ := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", bucketName, region))
	baseURL := &cosSDK.BaseURL{BucketURL: bucketURL}
	return cosSDK.NewClient(baseURL, &http.Client{
		Transport: &cosSDK.AuthorizationTransport{
			SecretID:  b.creds.AccessKeyID,
			SecretKey: b.creds.SecretAccessKey,
		},
	})
}
