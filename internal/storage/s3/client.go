package s3

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

	"can/internal/storage"
	"can/internal/types"
)

// S3Client reuses the canonical interface from the storage package.
type S3Client = storage.S3Client

// ClientFactory builds configured S3 clients from connection credentials.
type ClientFactory interface {
	NewClient(ctx context.Context, creds storage.ConnectionCredentials) (S3Client, error)
}

type clientFactory struct {
	httpClient *http.Client
	timeout    time.Duration
}

// ClientOption customises the S3 client factory.
type ClientOption func(*clientFactory)

// WithHTTPClient overrides the default HTTP client used by the factory.
func WithHTTPClient(client *http.Client) ClientOption {
	return func(factory *clientFactory) {
		factory.httpClient = client
	}
}

// WithHTTPTimeout adjusts the client timeout for S3 calls.
func WithHTTPTimeout(timeout time.Duration) ClientOption {
	return func(factory *clientFactory) {
		if timeout > 0 {
			factory.timeout = timeout
		}
	}
}

// NewClientFactory returns a production-ready factory.
func NewClientFactory(opts ...ClientOption) ClientFactory {
	factory := &clientFactory{timeout: 30 * time.Second}
	for _, opt := range opts {
		opt(factory)
	}
	if factory.httpClient == nil {
		factory.httpClient = defaultS3HTTPClient(factory.timeout)
	}
	return factory
}

func (f *clientFactory) NewClient(_ context.Context, creds storage.ConnectionCredentials) (S3Client, error) {
	cfg, usePathStyle, err := f.buildAWSConfig(creds)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.UsePathStyle = usePathStyle
	})
	return client, nil
}

func (f *clientFactory) buildAWSConfig(creds storage.ConnectionCredentials) (aws.Config, bool, error) {
	accessKey := strings.TrimSpace(creds.AccessKeyID)
	secret := strings.TrimSpace(creds.SecretAccessKey)
	if accessKey == "" || secret == "" {
		return aws.Config{}, false, errors.New("access key or secret missing")
	}
	region := strings.TrimSpace(creds.Region)
	if region == "" {
		region = DefaultRegionFor(creds.Provider)
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
		// For virtual-hosted style providers (OSS, COS), HostnameImmutable must be false
		// so SDK can prepend bucket name to the hostname
		hostnameImmutable := !requiresVirtualHostedStyle(creds.Provider)
		cfg.EndpointResolverWithOptions = aws.EndpointResolverWithOptionsFunc(func(service, region string, options ...any) (aws.Endpoint, error) {
			if service == s3.ServiceID {
				return aws.Endpoint{URL: resolvedEndpoint, HostnameImmutable: hostnameImmutable}, nil
			}
			return aws.Endpoint{}, &aws.EndpointNotFoundError{}
		})
	}
	usePathStyle := shouldUsePathStyle(creds.Provider)
	return cfg, usePathStyle, nil
}

// requiresVirtualHostedStyle returns true if the provider requires virtual-hosted style URLs.
func requiresVirtualHostedStyle(provider types.Provider) bool {
	switch provider {
	case types.ProviderAWS, types.ProviderOSS, types.ProviderCOS:
		return true
	default:
		return false
	}
}

func DefaultRegionFor(provider types.Provider) string {
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
	switch provider {
	case types.ProviderAWS, types.ProviderOSS, types.ProviderCOS:
		// AWS, OSS, COS require virtual-hosted style
		return false
	default:
		// MinIO, R2, Qiniu, custom endpoints typically use path style
		return true
	}
}

func normalizeEndpoint(creds storage.ConnectionCredentials) (string, bool, error) {
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
