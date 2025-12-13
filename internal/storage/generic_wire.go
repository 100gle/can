package storage

import (
	"context"
	"errors"
	"fmt"
	"strings"

	cosprovider "can/internal/storage/cos"
	ossprovider "can/internal/storage/oss"
	"can/internal/types"
	ossSDK "github.com/aliyun/aliyun-oss-go-sdk/oss"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/qiniu/go-sdk/v7/auth/qbox"
	qiniuStorage "github.com/qiniu/go-sdk/v7/storage"
	cosSDK "github.com/tencentyun/cos-go-sdk-v5"
)

// NewClient creates the generic storage client with typed SDK.
func NewClient[SDK VendorSDK](ctx context.Context, creds ConnectionCredentials) (*Client[SDK], error) {
	s3c, err := newS3(ctx, creds)
	if err != nil {
		return nil, err
	}

	sdk, bucketAPI, objectAPI, err := wireVendor[SDK](creds, s3c)
	if err != nil {
		return nil, err
	}

	return &Client[SDK]{
		provider: creds.Provider,
		s3:       s3c,
		sdk:      sdk,
		bucket:   bucketAPI,
		object:   objectAPI,
		security: pickSecurity(creds.Provider, creds),
		caps:     types.ProviderCapabilities(creds.Provider),
	}, nil
}

// NewOSSClient creates a client for Aliyun OSS.
func NewOSSClient(ctx context.Context, creds ConnectionCredentials) (*Client[*ossSDK.Client], error) {
	creds.Provider = types.ProviderOSS
	return NewClient[*ossSDK.Client](ctx, creds)
}

// NewCOSClient creates a client for Tencent COS.
func NewCOSClient(ctx context.Context, creds ConnectionCredentials) (*Client[*cosSDK.Client], error) {
	creds.Provider = types.ProviderCOS
	return NewClient[*cosSDK.Client](ctx, creds)
}

// NewMinIOClient creates a client for MinIO.
func NewMinIOClient(ctx context.Context, creds ConnectionCredentials) (*Client[*minio.Client], error) {
	creds.Provider = types.ProviderMinIO
	return NewClient[*minio.Client](ctx, creds)
}

// NewQiniuClient creates a client for Qiniu Kodo.
func NewQiniuClient(ctx context.Context, creds ConnectionCredentials) (*Client[*QiniuSDK], error) {
	creds.Provider = types.ProviderQiniu
	return NewClient[*QiniuSDK](ctx, creds)
}

// NewR2Client creates a client for Cloudflare R2 (S3 compatible path).
func NewR2Client(ctx context.Context, creds ConnectionCredentials) (*Client[struct{}], error) {
	creds.Provider = types.ProviderR2
	return NewClient[struct{}](ctx, creds)
}

// NewGenericS3Client creates a client for generic S3-compatible providers.
func NewGenericS3Client(ctx context.Context, creds ConnectionCredentials) (*Client[struct{}], error) {
	if creds.Provider == "" {
		creds.Provider = types.ProviderCustom
	}
	return NewClient[struct{}](ctx, creds)
}

// buildClient selects the generic instantiation based on provider.
func buildClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
	switch creds.Provider {
	case types.ProviderOSS:
		return NewOSSClient(ctx, creds)
	case types.ProviderCOS:
		return NewCOSClient(ctx, creds)
	case types.ProviderMinIO:
		return NewMinIOClient(ctx, creds)
	case types.ProviderQiniu:
		return NewQiniuClient(ctx, creds)
	case types.ProviderR2:
		return NewR2Client(ctx, creds)
	default:
		return NewGenericS3Client(ctx, creds)
	}
}

// wireVendor selects the SDK and domain APIs based on provider.
func wireVendor[SDK VendorSDK](creds ConnectionCredentials, s3c S3Client) (SDK, BucketAPI, ObjectAPI, error) {
	baseBucket, baseObject, driverErr := newS3APIs(s3c, creds)
	if driverErr != nil {
		var z SDK
		return z, nil, nil, driverErr
	}

	fail := func(reason string) (SDK, BucketAPI, ObjectAPI, error) {
		var z SDK
		return z, nil, nil, errors.New(reason)
	}

	switch creds.Provider {
	case types.ProviderOSS:
		ossClient, err := ossprovider.NewSDK(creds)
		if err != nil {
			return fail("create oss sdk")
		}
		typed, ok := any(ossClient).(SDK)
		if !ok {
			return fail("oss sdk type mismatch")
		}
		bucket := ossprovider.NewBucketAPI(baseBucket, ossClient)
		object := ossprovider.NewObjectAPI(baseObject, ossClient, creds)
		return typed, bucket, object, nil

	case types.ProviderCOS:
		cosClient, err := cosprovider.NewSDK(creds)
		if err != nil {
			return fail("create cos sdk")
		}
		typed, ok := any(cosClient).(SDK)
		if !ok {
			return fail("cos sdk type mismatch")
		}
		bucket := cosprovider.NewBucketAPI(baseBucket, creds)
		return typed, bucket, baseObject, nil

	case types.ProviderMinIO:
		minioSDK, err := newMinioSDK(creds)
		if err != nil {
			return fail("create minio sdk")
		}
		typed, ok := any(minioSDK).(SDK)
		if !ok {
			return fail("minio sdk type mismatch")
		}
		return typed, baseBucket, baseObject, nil

	case types.ProviderQiniu:
		qiniuSDK, err := newQiniuSDK(creds)
		if err != nil {
			return fail("create qiniu sdk")
		}
		typed, ok := any(qiniuSDK).(SDK)
		if !ok {
			return fail("qiniu sdk type mismatch")
		}
		return typed, baseBucket, baseObject, nil

	default:
		var sdk SDK
		return sdk, baseBucket, baseObject, nil
	}
}

// pickSecurity selects the security API for the provider.
func pickSecurity(provider types.Provider, creds ConnectionCredentials) SecurityAPI {
	if provider == types.ProviderAWS {
		return newAWSSecurityAPI(creds)
	}
	return newUnimplementedSecurityAPI()
}

// newMinioSDK builds the MinIO SDK client.
func newMinioSDK(creds ConnectionCredentials) (*minio.Client, error) {
	endpoint := strings.TrimSpace(creds.Endpoint)
	if endpoint == "" {
		return nil, errors.New("minio endpoint is required")
	}

	if creds.Port > 0 && !strings.Contains(endpoint, ":") {
		endpoint = fmt.Sprintf("%s:%d", endpoint, creds.Port)
	}

	opts := &minio.Options{
		Creds:  credentials.NewStaticV4(strings.TrimSpace(creds.AccessKeyID), strings.TrimSpace(creds.SecretAccessKey), ""),
		Secure: creds.UseSSL,
		Region: creds.Region,
	}

	return minio.New(endpoint, opts)
}

// newQiniuSDK builds the Qiniu Kodo SDK handles.
func newQiniuSDK(creds ConnectionCredentials) (*QiniuSDK, error) {
	accessKey := strings.TrimSpace(creds.AccessKeyID)
	secretKey := strings.TrimSpace(creds.SecretAccessKey)
	if accessKey == "" || secretKey == "" {
		return nil, errors.New("qiniu access key or secret missing")
	}

	mac := qbox.NewMac(accessKey, secretKey)
	cfg := &qiniuStorage.Config{
		UseHTTPS: creds.UseSSL,
	}

	bucketManager := qiniuStorage.NewBucketManager(mac, cfg)

	return &QiniuSDK{
		Mac:           mac,
		BucketManager: bucketManager,
		Config:        cfg,
	}, nil
}
