package providers

import (
	"context"
	"errors"

	"can/internal/types"
)

// ConnectionCredentials contains the necessary data to interact with a provider API.
type ConnectionCredentials struct {
	Provider        types.Provider `json:"provider"`
	Endpoint        string         `json:"endpoint"`
	AccessKeyID     string         `json:"accessKeyId"`
	SecretAccessKey string         `json:"secretAccessKey"`
	Region          string         `json:"region"`
	UseSSL          bool           `json:"useSSL"`
	Port            int            `json:"port"`
}

// Dialer probes endpoints to validate credentials.
type Dialer interface {
	TestConnection(ctx context.Context, credentials ConnectionCredentials) error
}

// StubDialer is a placeholder implementation used during early iterations.
type StubDialer struct{}

// TestConnection implements a lightweight sanity check without real network calls.
func (StubDialer) TestConnection(_ context.Context, credentials ConnectionCredentials) error {
	if credentials.AccessKeyID == "" || credentials.SecretAccessKey == "" {
		return errors.New("missing credentials")
	}
	if credentials.Endpoint == "" {
		return errors.New("missing endpoint")
	}
	return nil
}

// NewStubDialer returns a Dialer for development builds.
func NewStubDialer() Dialer {
	return StubDialer{}
}
