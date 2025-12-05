package providers

import (
	"context"
	"errors"

	"can/internal/types"
)

type storageFactory struct {
	s3Factory S3ClientFactory
}

// NewStorageFactory wires all known provider drivers together.
func NewStorageFactory(s3Factory S3ClientFactory) StorageFactory {
	if s3Factory == nil {
		s3Factory = NewS3ClientFactory()
	}
	return &storageFactory{s3Factory: s3Factory}
}

func (f *storageFactory) NewClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
	switch creds.Provider {
	case types.ProviderOSS:
		return newOSSStorageClient(ctx, creds)
	case types.ProviderCOS:
		return newCOSStorageClient(ctx, creds)
	default:
		return newS3StorageClient(ctx, creds, f.s3Factory)
	}
}

// ErrUnsupportedCapability helps drivers communicate unsupported operations.
var ErrUnsupportedCapability = errors.New("feature not supported for this provider")
