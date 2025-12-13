package s3

import (
	"context"

	"can/internal/storage"
)

func init() {
	storage.RegisterS3Builder(func(ctx context.Context, creds storage.ConnectionCredentials) (storage.S3Client, error) {
		return NewS3(ctx, creds)
	})
	storage.RegisterS3APIs(
		func(client storage.S3Client, creds storage.ConnectionCredentials) storage.BucketAPI {
			return NewBucketAPI(client, creds)
		},
		func(client storage.S3Client) storage.ObjectAPI {
			return NewObjectAPI(client)
		},
	)
}
