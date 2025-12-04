package providers

import (
	"context"

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
