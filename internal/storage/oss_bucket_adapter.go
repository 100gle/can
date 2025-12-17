package storage

import (
	"context"

	ossSDK "github.com/aliyun/aliyun-oss-go-sdk/oss"
)

// newOSSBucketAdapter wraps the S3 bucket API with OSS-specific features.
func newOSSBucketAdapter(base BucketAdapter, client *ossSDK.Client) BucketAdapter {
	return &ossBucketAdapter{
		BucketAdapter: base,
		client:        client,
	}
}

type ossBucketAdapter struct {
	BucketAdapter
	client *ossSDK.Client
}

func (b *ossBucketAdapter) GetBucketReferer(ctx context.Context, name string) (BucketReferer, error) {
	res, err := b.client.GetBucketReferer(name)
	if err != nil {
		return BucketReferer{}, err
	}

	return BucketReferer{
		Enabled:    len(res.RefererList) > 0 || res.AllowEmptyReferer,
		AllowEmpty: res.AllowEmptyReferer,
		Whitelist:  res.RefererList,
	}, nil
}

func (b *ossBucketAdapter) PutBucketReferer(ctx context.Context, name string, referer BucketReferer) error {
	return b.client.SetBucketReferer(name, referer.Whitelist, referer.AllowEmpty)
}
