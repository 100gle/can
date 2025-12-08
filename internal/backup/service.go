package backup

import (
	"context"
)

type Service interface {
	// CreateAppBackup creates a backup of all application settings and accounts.
	// Helper method to gather data from other services.
	CreateAppBackup(ctx context.Context, encrypted bool, password string) (*BackupHeader, []byte, error)

	// RestoreAppBackup restores application settings from a backup payload.
	RestoreAppBackup(ctx context.Context, data []byte, password string) error

	// CreateBucketSnapshot creates a snapshot of the current state of a bucket.
	CreateBucketSnapshot(ctx context.Context, accountID, bucket string) (*BackupHeader, error)

	// ListSnapshots returns available snapshots for a bucket.
	ListSnapshots(ctx context.Context, accountID, bucket string) ([]*BackupHeader, error)

	// RestoreSnapshot restores missing files from a snapshot (or just reports diff).
	// For MVP, maybe just diff.
	RestoreSnapshot(ctx context.Context, snapshotID string) error

	// DeleteSnapshot removes a snapshot from the store.
	DeleteSnapshot(ctx context.Context, snapshotID string) error
}
