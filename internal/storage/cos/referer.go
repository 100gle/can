package cos

import (
	"context"

	"github.com/tencentyun/cos-go-sdk-v5"

	"can/internal/storage"
)

func (b *bucketAdapter) GetBucketReferer(ctx context.Context, name string) (storage.BucketReferer, error) {
	client := b.buildClient(name, "")
	res, _, err := client.Bucket.GetReferer(ctx)
	if err != nil {
		return storage.BucketReferer{}, err
	}

	return storage.BucketReferer{
		Enabled:    res.Status == "Enabled",
		AllowEmpty: res.EmptyReferConfiguration == "Allow",
		Whitelist:  res.DomainList,
		Mode:       res.RefererType, // "Black-List" or "White-List"
	}, nil
}

func (b *bucketAdapter) PutBucketReferer(ctx context.Context, name string, referer storage.BucketReferer) error {
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

	opt := &cos.BucketPutRefererOptions{
		Status:                  status,
		RefererType:             refType,
		DomainList:              referer.Whitelist,
		EmptyReferConfiguration: emptyRef,
	}

	_, err := client.Bucket.PutReferer(ctx, opt)
	return err
}
