package providers

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/aws/retry"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"can/internal/types"
)

// S3Client defines the subset of operations required by CAN services.
type S3Client interface {
	ListBuckets(ctx context.Context, params *s3.ListBucketsInput, optFns ...func(*s3.Options)) (*s3.ListBucketsOutput, error)
	CreateBucket(ctx context.Context, params *s3.CreateBucketInput, optFns ...func(*s3.Options)) (*s3.CreateBucketOutput, error)
	DeleteBucket(ctx context.Context, params *s3.DeleteBucketInput, optFns ...func(*s3.Options)) (*s3.DeleteBucketOutput, error)
	HeadBucket(ctx context.Context, params *s3.HeadBucketInput, optFns ...func(*s3.Options)) (*s3.HeadBucketOutput, error)
	GetBucketLocation(ctx context.Context, params *s3.GetBucketLocationInput, optFns ...func(*s3.Options)) (*s3.GetBucketLocationOutput, error)
	ListObjectsV2(ctx context.Context, params *s3.ListObjectsV2Input, optFns ...func(*s3.Options)) (*s3.ListObjectsV2Output, error)
	GetObject(ctx context.Context, params *s3.GetObjectInput, optFns ...func(*s3.Options)) (*s3.GetObjectOutput, error)
	PutObject(ctx context.Context, params *s3.PutObjectInput, optFns ...func(*s3.Options)) (*s3.PutObjectOutput, error)
	DeleteObject(ctx context.Context, params *s3.DeleteObjectInput, optFns ...func(*s3.Options)) (*s3.DeleteObjectOutput, error)
	CopyObject(ctx context.Context, params *s3.CopyObjectInput, optFns ...func(*s3.Options)) (*s3.CopyObjectOutput, error)
	HeadObject(ctx context.Context, params *s3.HeadObjectInput, optFns ...func(*s3.Options)) (*s3.HeadObjectOutput, error)
	CreateMultipartUpload(ctx context.Context, params *s3.CreateMultipartUploadInput, optFns ...func(*s3.Options)) (*s3.CreateMultipartUploadOutput, error)
	UploadPart(ctx context.Context, params *s3.UploadPartInput, optFns ...func(*s3.Options)) (*s3.UploadPartOutput, error)
	CompleteMultipartUpload(ctx context.Context, params *s3.CompleteMultipartUploadInput, optFns ...func(*s3.Options)) (*s3.CompleteMultipartUploadOutput, error)
	AbortMultipartUpload(ctx context.Context, params *s3.AbortMultipartUploadInput, optFns ...func(*s3.Options)) (*s3.AbortMultipartUploadOutput, error)
}

// S3ClientFactory builds configured S3 clients from connection credentials.
type S3ClientFactory interface {
	NewClient(ctx context.Context, creds ConnectionCredentials) (S3Client, error)
}

type s3ClientFactory struct {
	httpClient *http.Client
	timeout    time.Duration
}

// S3ClientOption customises the S3 client factory.
type S3ClientOption func(*s3ClientFactory)

// WithHTTPClient overrides the default HTTP client used by the factory.
func WithHTTPClient(client *http.Client) S3ClientOption {
	return func(factory *s3ClientFactory) {
		factory.httpClient = client
	}
}

// WithHTTPTimeout adjusts the client timeout for S3 calls.
func WithHTTPTimeout(timeout time.Duration) S3ClientOption {
	return func(factory *s3ClientFactory) {
		if timeout > 0 {
			factory.timeout = timeout
		}
	}
}

// NewS3ClientFactory returns a production-ready factory.
func NewS3ClientFactory(opts ...S3ClientOption) S3ClientFactory {
	factory := &s3ClientFactory{timeout: 30 * time.Second}
	for _, opt := range opts {
		opt(factory)
	}
	if factory.httpClient == nil {
		factory.httpClient = defaultS3HTTPClient(factory.timeout)
	}
	return factory
}

func (f *s3ClientFactory) NewClient(_ context.Context, creds ConnectionCredentials) (S3Client, error) {
	cfg, usePathStyle, err := f.buildAWSConfig(creds)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = usePathStyle
	})
	return client, nil
}

func (f *s3ClientFactory) buildAWSConfig(creds ConnectionCredentials) (aws.Config, bool, error) {
	accessKey := strings.TrimSpace(creds.AccessKeyID)
	secret := strings.TrimSpace(creds.SecretAccessKey)
	if accessKey == "" || secret == "" {
		return aws.Config{}, false, errors.New("access key or secret missing")
	}
	region := strings.TrimSpace(creds.Region)
	if region == "" {
		region = defaultRegionFor(creds.Provider)
	}
	endpoint, hasEndpoint, err := normalizeEndpoint(creds)
	if err != nil {
		return aws.Config{}, false, err
	}
	if !hasEndpoint && creds.Provider != types.ProviderAWS {
		return aws.Config{}, false, fmt.Errorf("provider %s requires endpoint", creds.Provider)
	}
	cfg := aws.Config{}
	cfg.Region = region
	cfg.Credentials = aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(accessKey, secret, ""))
	cfg.Retryer = func() aws.Retryer {
		return retry.AddWithMaxAttempts(retry.NewStandard(), 5)
	}
	cfg.HTTPClient = f.httpClient
	if hasEndpoint {
		resolvedEndpoint := endpoint
		cfg.EndpointResolverWithOptions = aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...interface{}) (aws.Endpoint, error) {
			if service == s3.ServiceID {
				return aws.Endpoint{URL: resolvedEndpoint, HostnameImmutable: true}, nil
			}
			return aws.Endpoint{}, &aws.EndpointNotFoundError{}
		})
	}
	usePathStyle := shouldUsePathStyle(creds.Provider)
	return cfg, usePathStyle, nil
}

func defaultRegionFor(provider types.Provider) string {
	switch provider {
	case types.ProviderR2:
		return "auto"
	case types.ProviderOSS:
		return "cn-hangzhou"
	case types.ProviderCOS:
		return "ap-guangzhou"
	default:
		return "us-east-1"
	}
}

func shouldUsePathStyle(provider types.Provider) bool {
	if provider == types.ProviderAWS {
		return false
	}
	return true
}

func normalizeEndpoint(creds ConnectionCredentials) (string, bool, error) {
	raw := strings.TrimSpace(creds.Endpoint)
	if raw == "" {
		return "", false, nil
	}
	if !strings.Contains(raw, "://") {
		scheme := "https"
		if !creds.UseSSL {
			scheme = "http"
		}
		raw = fmt.Sprintf("%s://%s", scheme, raw)
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", false, fmt.Errorf("invalid endpoint: %w", err)
	}
	if parsed.Scheme == "" {
		parsed.Scheme = "https"
		if !creds.UseSSL {
			parsed.Scheme = "http"
		}
	}
	if parsed.Port() == "" && creds.Port > 0 {
		parsed.Host = net.JoinHostPort(parsed.Hostname(), strconv.Itoa(creds.Port))
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/")
	if parsed.Path == "" {
		parsed.Path = "/"
	}
	return parsed.String(), true, nil
}

func defaultS3HTTPClient(timeout time.Duration) *http.Client {
	transport := &http.Transport{
		Proxy:               http.ProxyFromEnvironment,
		DialContext:         (&net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
		ForceAttemptHTTP2:   true,
		TLSHandshakeTimeout: 10 * time.Second,
		MaxIdleConns:        100,
		IdleConnTimeout:     90 * time.Second,
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
		},
	}
	return &http.Client{Timeout: timeout, Transport: transport}
}
