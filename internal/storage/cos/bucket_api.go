package cos

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	cosSDK "github.com/tencentyun/cos-go-sdk-v5"

	api "can/internal/storage/api"
)

// NewBucketAPI decorates the S3 bucket API with COS-specific features.
func NewBucketAPI(base api.BucketAPI, creds api.ConnectionCredentials) api.BucketAPI {
	return &bucketAPI{
		BucketAPI: base,
		creds:     creds,
	}
}

type bucketAPI struct {
	api.BucketAPI
	creds api.ConnectionCredentials
}

func (b *bucketAPI) CreateBucket(ctx context.Context, input api.BucketCreateInput) error {
	if !input.COSMultiAZ {
		return b.BucketAPI.CreateBucket(ctx, input)
	}
	bucketName := strings.TrimSpace(input.Name)
	if bucketName == "" {
		return errors.New("bucket name is required")
	}
	region := strings.TrimSpace(input.Region)
	client := b.buildClient(bucketName, region)
	opt := &cosSDK.BucketPutOptions{
		CreateBucketConfiguration: &cosSDK.CreateBucketConfiguration{
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

func (b *bucketAPI) GetBucketMAZConfig(ctx context.Context, name string) (*api.MAZConfiguration, error) {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return nil, errors.New("bucket name is required")
	}
	client := b.buildClient(bucketName, "")
	meta, _, err := client.Bucket.GetMeta(ctx, bucketName)
	if err != nil {
		return nil, err
	}
	status := api.MAZStatusDisabled
	if meta != nil && meta.MAZ {
		status = api.MAZStatusEnabled
	}
	return &api.MAZConfiguration{Status: status}, nil
}

func (b *bucketAPI) EnableBucketMAZ(ctx context.Context, name string) error {
	return api.ErrUnsupportedCapability
}

func (b *bucketAPI) DisableBucketMAZ(ctx context.Context, name string) error {
	return api.ErrUnsupportedCapability
}

func (b *bucketAPI) GetBucketReferer(ctx context.Context, name string) (api.BucketReferer, error) {
	client := b.buildClient(name, "")
	res, _, err := client.Bucket.GetReferer(ctx)
	if err != nil {
		return api.BucketReferer{}, err
	}

	return api.BucketReferer{
		Enabled:    res.Status == "Enabled",
		AllowEmpty: res.EmptyReferConfiguration == "Allow",
		Whitelist:  res.DomainList,
		Mode:       res.RefererType, // "Black-List" or "White-List"
	}, nil
}

func (b *bucketAPI) PutBucketReferer(ctx context.Context, name string, referer api.BucketReferer) error {
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

func (b *bucketAPI) buildClient(bucketName, regionHint string) *cosSDK.Client {
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
