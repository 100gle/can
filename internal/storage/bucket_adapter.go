package storage

import "context"

type BucketAdapter interface {
	ListBuckets(ctx context.Context) ([]BucketDescriptor, error)
	CreateBucket(ctx context.Context, input BucketCreateInput) error
	DeleteBucket(ctx context.Context, name string) error
	HeadBucket(ctx context.Context, name string) error
	BucketLocation(ctx context.Context, name string) (string, error)
	GetBucketACL(ctx context.Context, name string) (BucketACL, error)
	PutBucketACL(ctx context.Context, name string, acl BucketACLInput) error
	GetPublicAccessBlock(ctx context.Context, name string) (PublicAccessBlock, error)
	PutPublicAccessBlock(ctx context.Context, name string, block PublicAccessBlock) error
	GetBucketReferer(ctx context.Context, name string) (BucketReferer, error)
	PutBucketReferer(ctx context.Context, name string, referer BucketReferer) error
	GetBucketEncryption(ctx context.Context, bucket string) (*BucketEncryptionConfiguration, error)
	PutBucketEncryption(ctx context.Context, bucket string, config BucketEncryptionConfiguration) error
	DeleteBucketEncryption(ctx context.Context, bucket string) error
	GetBucketPolicy(ctx context.Context, bucket string) (string, error)
	PutBucketPolicy(ctx context.Context, bucket, policy string) error
	DeleteBucketPolicy(ctx context.Context, bucket string) error
	GetBucketVersioning(ctx context.Context, bucket string) (BucketVersioningStatus, error)
	PutBucketVersioning(ctx context.Context, bucket string, status BucketVersioningStatus) error
	GetBucketLifecycleConfiguration(ctx context.Context, bucket string) ([]LifecycleRule, error)
	PutBucketLifecycleConfiguration(ctx context.Context, bucket string, rules []LifecycleRule) error
	DeleteBucketLifecycle(ctx context.Context, bucket string) error
	GetBucketCors(ctx context.Context, bucket string) ([]CORSRule, error)
	PutBucketCors(ctx context.Context, bucket string, rules []CORSRule) error
	DeleteBucketCors(ctx context.Context, bucket string) error
	GetBucketWebsite(ctx context.Context, bucket string) (*BucketWebsiteConfiguration, error)
	PutBucketWebsite(ctx context.Context, bucket string, config BucketWebsiteConfiguration) error
	DeleteBucketWebsite(ctx context.Context, bucket string) error
	GetBucketMAZConfig(ctx context.Context, name string) (*MAZConfiguration, error)
	EnableBucketMAZ(ctx context.Context, name string) error
	DisableBucketMAZ(ctx context.Context, name string) error
}
