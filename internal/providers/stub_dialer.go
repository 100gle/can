package providers

import "context"

// stubDialer is reserved for unit tests to avoid network calls.
type stubDialer struct {
	err error
}

// TestConnection returns the injected error.
func (s stubDialer) TestConnection(context.Context, ConnectionCredentials) error {
	return s.err
}

// NewStubDialer creates a no-op dialer useful in tests.
func NewStubDialer() Dialer {
	return stubDialer{}
}

// NewFailingDialer creates a stub dialer that always fails.
func NewFailingDialer(err error) Dialer {
	return stubDialer{err: err}
}
