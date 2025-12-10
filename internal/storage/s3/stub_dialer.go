package s3

import (
	"context"

	"can/internal/storage"
)

// stubDialer is reserved for unit tests to avoid network calls.
type stubDialer struct {
	err error
}

// TestConnection returns the injected error.
func (s stubDialer) TestConnection(context.Context, storage.ConnectionCredentials) error {
	return s.err
}

// NewStubDialer creates a no-op dialer useful in tests.
func NewStubDialer() storage.Dialer {
	return stubDialer{}
}

// NewFailingDialer creates a stub dialer that always fails.
func NewFailingDialer(err error) storage.Dialer {
	return stubDialer{err: err}
}
