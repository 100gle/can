package providers

import (
	"context"
	"errors"
	"fmt"

	"can/internal/types"
)

type storageFactory struct {
	s3Factory      S3ClientFactory
	builders       map[types.Provider]StorageBuilder
	defaultBuilder StorageBuilder
}

// StorageBuilder creates a provider-specific storage client from credentials.
type StorageBuilder func(ctx context.Context, creds ConnectionCredentials) (StorageClient, error)

// StorageFactoryOption customises the storage factory wiring.
type StorageFactoryOption func(*storageFactory)

// WithStorageBuilder overrides the builder for a specific provider. Passing nil removes it.
func WithStorageBuilder(provider types.Provider, builder StorageBuilder) StorageFactoryOption {
	return func(factory *storageFactory) {
		if factory == nil {
			return
		}
		if builder == nil {
			delete(factory.builders, provider)
			return
		}
		factory.builders[provider] = builder
	}
}

// WithDefaultStorageBuilder overrides the fallback builder used for unknown providers.
func WithDefaultStorageBuilder(builder StorageBuilder) StorageFactoryOption {
	return func(factory *storageFactory) {
		if factory == nil {
			return
		}
		factory.defaultBuilder = builder
	}
}

// NewStorageFactory wires all known provider drivers together.
func NewStorageFactory(s3Factory S3ClientFactory, opts ...StorageFactoryOption) StorageFactory {
	if s3Factory == nil {
		s3Factory = NewS3ClientFactory()
	}
	factory := &storageFactory{
		s3Factory: s3Factory,
		builders:  make(map[types.Provider]StorageBuilder),
	}
	factory.defaultBuilder = factory.s3StorageBuilder()
	factory.builders[types.ProviderOSS] = factory.ossStorageBuilder()
	factory.builders[types.ProviderCOS] = factory.cosStorageBuilder()
	for _, opt := range opts {
		opt(factory)
	}
	return factory
}

func (f *storageFactory) NewClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
	if builder := f.builders[creds.Provider]; builder != nil {
		return builder(ctx, creds)
	}
	if f.defaultBuilder != nil {
		return f.defaultBuilder(ctx, creds)
	}
	return nil, fmt.Errorf("storage provider %s is not supported", creds.Provider)
}

// ErrUnsupportedCapability helps drivers communicate unsupported operations.
var ErrUnsupportedCapability = errors.New("feature not supported for this provider")

func (f *storageFactory) s3StorageBuilder() StorageBuilder {
	return func(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
		return newS3StorageClient(ctx, creds, f.s3Factory)
	}
}

func (f *storageFactory) ossStorageBuilder() StorageBuilder {
	return func(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
		return newOSSStorageClient(ctx, creds)
	}
}

func (f *storageFactory) cosStorageBuilder() StorageBuilder {
	return func(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
		return newCOSStorageClient(ctx, creds)
	}
}
