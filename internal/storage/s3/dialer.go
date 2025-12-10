package s3

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/service/s3"

	"can/internal/storage"
)

// S3DialerOption configures the dialer behaviour.
type S3DialerOption func(*S3Dialer)

// WithDialTimeout overrides the default connection timeout.
func WithDialTimeout(timeout time.Duration) S3DialerOption {
	return func(d *S3Dialer) {
		if timeout > 0 {
			d.timeout = timeout
		}
	}
}

// WithS3ClientFactory injects a custom S3 client factory.
func WithS3ClientFactory(factory ClientFactory) S3DialerOption {
	return func(d *S3Dialer) {
		if factory != nil {
			d.factory = factory
		}
	}
}

// S3Dialer validates credentials using real S3-compatible calls.
type S3Dialer struct {
	factory ClientFactory
	timeout time.Duration
}

// NewDialer returns a production-ready dialer.
func NewDialer(opts ...S3DialerOption) storage.Dialer {
	dialer := &S3Dialer{
		factory: NewClientFactory(),
		timeout: 15 * time.Second,
	}
	for _, opt := range opts {
		opt(dialer)
	}
	return dialer
}

// TestConnection attempts to list buckets to validate credentials and endpoint reachability.
func (d *S3Dialer) TestConnection(ctx context.Context, credentials storage.ConnectionCredentials) error {
	if d == nil {
		return nil
	}
	localCtx := ctx
	var cancel context.CancelFunc
	if deadline, ok := ctx.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining <= 0 {
			return context.DeadlineExceeded
		}
	} else {
		localCtx, cancel = context.WithTimeout(ctx, d.timeout)
		defer cancel()
	}
	client, err := d.factory.NewClient(localCtx, credentials)
	if err != nil {
		return WrapS3Error("初始化 S3 客户端", err)
	}
	_, err = client.ListBuckets(localCtx, &s3.ListBucketsInput{})
	if err != nil {
		return WrapS3Error("验证凭证", err)
	}
	return nil
}
