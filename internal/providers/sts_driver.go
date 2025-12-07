package providers

import (
	"context"
	"errors"
	"time"
)

var ErrNotImplemented = errors.New("feature not implemented by this provider")

// SecurityTokens represents the temporary credentials response.
type SecurityTokens struct {
	AccessKeyId     string    `json:"accessKeyId"`
	SecretAccessKey string    `json:"secretAccessKey"`
	SessionToken    string    `json:"sessionToken"`
	Expiration      time.Time `json:"expiration"`
}

// GenerateTokensRequest captures parameters for STS generation.
type GenerateTokensRequest struct {
	DurationSeconds int64  `json:"durationSeconds"`
	Policy          string `json:"policy,omitempty"` // Optional JSON policy
}

// SecurityDriver exposes security/STS operations.
type SecurityDriver interface {
	GenerateTemporaryCredentials(ctx context.Context, req GenerateTokensRequest) (SecurityTokens, error)
}

// UnimplementedSecurityDriver is a stub for providers that don't support STS.
type UnimplementedSecurityDriver struct{}

func (u *UnimplementedSecurityDriver) GenerateTemporaryCredentials(ctx context.Context, req GenerateTokensRequest) (SecurityTokens, error) {
	return SecurityTokens{}, ErrNotImplemented
}
