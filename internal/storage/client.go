package storage

import (
	"context"
	"errors"
	"time"

	"can/internal/types"

	"github.com/aws/aws-sdk-go-v2/service/s3"
)

var ErrUnsupportedProvider = errors.New("unsupported provider")

type Client struct {
	ID       string
	Name     string
	Tag      string
	Provider types.Provider
	Endpoint string
	Region   string
	UseSSL   bool
	Port     int
	Bucket   BucketAdapter
	Object   ObjectAdapter
	Security SecurityAdapter
	S3       S3Client
	SDK      any
	Features Feature
}

type ClientBuilder func(ctx context.Context, rec ClientRecord) (*Client, error)

func NewClient(ctx context.Context, rec ClientRecord) (*Client, error) {
	creds := toCredentials(rec)
	base, baseBucket, baseObject, err := buildBaseS3(ctx, creds)
	if err != nil {
		return nil, err
	}

	client := &Client{
		ID:       rec.ID,
		Name:     rec.Name,
		Tag:      rec.Tag,
		Provider: creds.Provider,
		Endpoint: creds.Endpoint,
		Region:   creds.Region,
		UseSSL:   creds.UseSSL,
		Port:     creds.Port,
		Bucket:   baseBucket,
		Object:   baseObject,
		Security: newUnimplementedSecurity(),
		S3:       base,
		Features: providerFeatures(creds.Provider),
	}

	switch creds.Provider {
	case types.ProviderOSS:
		sdk, err := newOSSSDK(creds)
		if err != nil {
			return nil, err
		}
		client.Bucket = newOSSBucketAdapter(baseBucket, sdk)
		client.Object = newOSSObjectAdapter(baseObject, sdk, creds)
		client.SDK = sdk
	case types.ProviderCOS:
		sdk, err := newCOSSDK(creds)
		if err != nil {
			return nil, err
		}
		client.Bucket = newCOSBucketAdapter(baseBucket, creds)
		client.SDK = sdk
	case types.ProviderAWS:
		client.Security = newAWSSecurity(creds)
	case types.ProviderMinIO:
		sdk, err := newMinioSDK(creds)
		if err != nil {
			return nil, err
		}
		client.SDK = sdk
	case types.ProviderQiniu:
		sdk, err := newQiniuSDK(creds)
		if err != nil {
			return nil, err
		}
		client.SDK = sdk
	case types.ProviderR2, types.ProviderCustom:
		// Use base S3 adapters
	default:
		return nil, ErrUnsupportedProvider
	}

	return client, nil
}

func toCredentials(rec ClientRecord) Credentials {
	provider := rec.Provider
	if provider == "" {
		provider = types.ProviderCustom
	}
	return Credentials{
		Provider:        provider,
		Endpoint:        rec.Endpoint,
		AccessKeyID:     rec.AccessKeyID,
		SecretAccessKey: rec.SecretAccessKey,
		Region:          rec.Region,
		UseSSL:          rec.UseSSL,
		Port:            rec.Port,
	}
}

func buildBaseS3(ctx context.Context, creds Credentials) (S3Client, BucketAdapter, ObjectAdapter, error) {
	s3client, err := NewS3(ctx, creds)
	if err != nil {
		return nil, nil, nil, err
	}
	bucketAdapter := newS3BucketAdapter(s3client, creds)
	objectAdapter := newS3ObjectAdapter(s3client)
	return s3client, bucketAdapter, objectAdapter, nil
}

// Dial validates that the underlying S3 connection is reachable with current credentials.
// It uses a lightweight ListBuckets call and applies a default timeout when the caller
// does not supply one via context.
// It returns the list of bucket names if successful.
func (c *Client) Dial(ctx context.Context) ([]string, error) {
	if c == nil || c.S3 == nil {
		return nil, errors.New("client not initialized")
	}
	localCtx := ctx
	var cancel context.CancelFunc
	if deadline, ok := ctx.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			return nil, context.DeadlineExceeded
		}
	} else {
		localCtx, cancel = context.WithTimeout(ctx, 15*time.Second)
		defer cancel()
	}
	output, err := c.S3.ListBuckets(localCtx, &s3.ListBucketsInput{})
	if err != nil {
		return nil, WrapS3Error("验证凭证", err)
	}

	buckets := make([]string, 0, len(output.Buckets))
	for _, b := range output.Buckets {
		if b.Name != nil {
			buckets = append(buckets, *b.Name)
		}
	}
	return buckets, nil
}
