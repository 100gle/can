package oss

import (
	"context"

	"can/internal/storage"
)

func (b *bucketAdapter) GetBucketReferer(ctx context.Context, name string) (storage.BucketReferer, error) {
	// OSS SDK GetBucketReferer is on Client, not Bucket
	// Signature: func (client Client) GetBucketReferer(bucketName string, options ...Option) (GetBucketRefererResult, error)
	res, err := b.client.GetBucketReferer(name)
	if err != nil {
		return storage.BucketReferer{}, err
	}

	return storage.BucketReferer{
		Enabled:    len(res.RefererList) > 0 || res.AllowEmptyReferer,
		AllowEmpty: res.AllowEmptyReferer,
		Whitelist:  res.RefererList,
	}, nil
}

func (b *bucketAdapter) PutBucketReferer(ctx context.Context, name string, referer storage.BucketReferer) error {
	// OSS SDK SetBucketReferer is on Client
	// Signature: func (client Client) SetBucketReferer(bucketName string, referrers []string, allowEmptyReferer bool, ...) error
	return b.client.SetBucketReferer(name, referer.Whitelist, referer.AllowEmpty)
}
