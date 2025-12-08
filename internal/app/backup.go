package app

import (
	"can/internal/backup"
	"os"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// CreateAppBackup triggers the application configuration backup flow.
func (a *App) CreateAppBackup(encrypted bool, password string) (*backup.BackupHeader, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()

	header, data, err := a.backup.CreateAppBackup(ctx, encrypted, password)
	if err != nil {
		return nil, err
	}

	// Prompt user to save the file
	fileFilter := runtime.FileFilter{DisplayName: "CAN Backup (*.canbak)", Pattern: "*.canbak"}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Save Backup",
		DefaultFilename: "can_backup.canbak",
		Filters:         []runtime.FileFilter{fileFilter},
	})
	if err != nil {
		return nil, err
	}
	if path == "" {
		return nil, nil // Cancelled
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return nil, err
	}

	return header, nil
}

// RestoreAppBackup imports application configuration from a backup file.
func (a *App) RestoreAppBackup(password string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()

	fileFilter := runtime.FileFilter{DisplayName: "CAN Backup (*.canbak)", Pattern: "*.canbak"}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   "Select Backup File",
		Filters: []runtime.FileFilter{fileFilter},
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	return a.backup.RestoreAppBackup(ctx, data, password)
}

// CreateBucketSnapshot creates a metadata snapshot of the bucket.
func (a *App) CreateBucketSnapshot(accountID, bucket string) (*backup.BackupHeader, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.backup.CreateBucketSnapshot(ctx, accountID, bucket)
}

// ListBucketSnapshots returns all snapshots for a bucket.
func (a *App) ListBucketSnapshots(accountID, bucket string) ([]*backup.BackupHeader, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.backup.ListSnapshots(ctx, accountID, bucket)
}

// DeleteBucketSnapshot removes a snapshot by ID.
func (a *App) DeleteBucketSnapshot(snapshotID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.backup.DeleteSnapshot(ctx, snapshotID)
}
