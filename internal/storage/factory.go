package storage

import "context"

type storageFactory struct{}

// NewStorageFactory creates a thin factory wrapper over NewClient.
func NewStorageFactory(_ ...StorageFactoryOption) StorageFactory {
	return &storageFactory{}
}

// StorageFactoryOption is kept for backward compatibility; it is ignored.
type StorageFactoryOption func(*storageFactory)

// NewClient delegates to the unified NewClient provider switch.
func (f *storageFactory) NewClient(ctx context.Context, creds ConnectionCredentials) (StorageClient, error) {
	return buildClient(ctx, creds)
}
