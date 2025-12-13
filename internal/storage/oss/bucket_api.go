package oss

import (
	"context"

	ossSDK "github.com/aliyun/aliyun-oss-go-sdk/oss"

	api "can/internal/storage/api"
)

// NewBucketAPI wraps the S3 bucket API with OSS-specific features.
func NewBucketAPI(base api.BucketAPI, client *ossSDK.Client) api.BucketAPI {
	return &bucketAPI{
		BucketAPI: base,
		client:    client,
	}
}

type bucketAPI struct {
	api.BucketAPI
	client *ossSDK.Client
}

func (b *bucketAPI) GetBucketReferer(ctx context.Context, name string) (api.BucketReferer, error) {
	res, err := b.client.GetBucketReferer(name)
	if err != nil {
		return api.BucketReferer{}, err
	}

	return api.BucketReferer{
		Enabled:    len(res.RefererList) > 0 || res.AllowEmptyReferer,
		AllowEmpty: res.AllowEmptyReferer,
		Whitelist:  res.RefererList,
	}, nil
}

func (b *bucketAPI) PutBucketReferer(ctx context.Context, name string, referer api.BucketReferer) error {
	return b.client.SetBucketReferer(name, referer.Whitelist, referer.AllowEmpty)
}
