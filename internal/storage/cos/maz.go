package cos

import (
	"context"
	"errors"
	"strings"

	"can/internal/storage"
)

func (b *bucketAdapter) GetBucketMAZConfig(ctx context.Context, name string) (*storage.MAZConfiguration, error) {
	bucketName := strings.TrimSpace(name)
	if bucketName == "" {
		return nil, errors.New("bucket name is required")
	}
	client := b.buildClient(bucketName, "")
	meta, _, err := client.Bucket.GetMeta(ctx, bucketName)
	if err != nil {
		return nil, err
	}
	status := storage.MAZStatusDisabled
	if meta != nil && meta.MAZ {
		status = storage.MAZStatusEnabled
	}
	return &storage.MAZConfiguration{Status: status}, nil
}

func (b *bucketAdapter) EnableBucketMAZ(ctx context.Context, name string) error {
	return storage.ErrUnsupportedCapability
}

func (b *bucketAdapter) DisableBucketMAZ(ctx context.Context, name string) error {
	return storage.ErrUnsupportedCapability
}
