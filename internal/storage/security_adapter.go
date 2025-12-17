package storage

import (
	"context"
	"errors"
)

type SecurityAdapter interface {
	GenerateTemporaryCredentials(ctx context.Context, req GenerateTokensRequest) (SecurityTokens, error)
}

// UnimplementedSecurityAPI is a stub for providers that don't support STS.
type UnimplementedSecurityAPI struct{}

func (u *UnimplementedSecurityAPI) GenerateTemporaryCredentials(ctx context.Context, req GenerateTokensRequest) (SecurityTokens, error) {
	return SecurityTokens{}, errors.New("feature not implemented by this provider")
}

func newUnimplementedSecurity() SecurityAdapter {
	return &UnimplementedSecurityAPI{}
}
