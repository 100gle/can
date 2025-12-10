package storage

import (
	"context"
	"errors"
	"fmt"

	"can/internal/types"
)

type storageFactory struct {
	builders       map[types.Provider]StorageBuilder
	defaultBuilder StorageBuilder
}

// StorageBuilder creates a provider-specific storage client from credentials.
type StorageBuilder func(ctx context.Context, creds ConnectionCredentials) (StorageClient, error)

// StorageFactoryOption customises the storage factory wiring.
type StorageFactoryOption func(*storageFactory)

// WithStorageBuilder registers the builder for a specific provider. Passing nil removes it.
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

// NewStorageFactory creates a factory with the given provider builders.
func NewStorageFactory(opts ...StorageFactoryOption) StorageFactory {
	factory := &storageFactory{
		builders: make(map[types.Provider]StorageBuilder),
	}
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
