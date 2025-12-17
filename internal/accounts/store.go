package accounts

import (
	"context"
)

// Store defines persistence operations for storage accounts.
type Store interface {
	List(ctx context.Context) ([]accountRecord, error)
	Get(ctx context.Context, id string) (accountRecord, error)
	Save(ctx context.Context, account accountRecord) error
	Update(ctx context.Context, account accountRecord) error
	Delete(ctx context.Context, id string) error
	Count(ctx context.Context) (int, error)
}
