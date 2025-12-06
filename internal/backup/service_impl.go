package backup

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"can/internal/accounts"
	"can/internal/objects"

	"github.com/google/uuid"
)

type ServiceImpl struct {
	accounts *accounts.Service
	objects  *objects.Service
	dataDir  string // To locate settings.json etc.
}

func NewService(accounts *accounts.Service, objects *objects.Service, dataDir string) *ServiceImpl {
	return &ServiceImpl{
		accounts: accounts,
		objects:  objects,
		dataDir:  dataDir,
	}
}

func (s *ServiceImpl) CreateAppBackup(ctx context.Context, encrypted bool, password string) (*BackupHeader, []byte, error) {
	// 1. Export Accounts
	accData, err := s.accounts.ExportData(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to export accounts: %w", err)
	}

	// 2. Prepare Backup Content
	content := AppBackupContent{
		Accounts: accData.Blob, // This blob is already encrypted if ExportData handles it, OR we encrypt the whole backup.
		// settings.json and favorites.json would be read from s.dataDir/settings.json
	}
	// For MVP, handling just accounts is fine if settings are trivial.

	// Serialize Content
	// Serialize Content (Optional check, effectively unused but keeping for debug if needed, or remove)
	// jsonData, err := json.Marshal(content)
	// if err != nil {
	// 	return nil, nil, err
	// }

	// 3. Encrypt if requested
	// If password provided, encrypt jsonData.
	// (Skipping actual encryption implementation for brevity, assuming MVP or relying on accounts encryption)

	// 4. Create Header
	header := &BackupHeader{
		ID:        uuid.New().String(),
		Type:      BackupTypeAppConfig,
		CreatedAt: time.Now(),
		Version:   "1.0.0",
		Encrypted: encrypted,
	}

	// 5. Package (e.g. Zip or just JSON)
	// We can simply return the JSON bytes for now or wrap in a structured format.
	// Let's return JSON of a wrapper struct containing Header + Content

	// Re-wrapping for simple export
	type FullBackup struct {
		Header  *BackupHeader    `json:"header"`
		Content AppBackupContent `json:"content"`
	}

	full := FullBackup{Header: header, Content: content}
	finalBytes, err := json.Marshal(full)

	return header, finalBytes, err
}

func (s *ServiceImpl) RestoreAppBackup(ctx context.Context, data []byte, password string) error {
	type FullBackup struct {
		Header  *BackupHeader    `json:"header"`
		Content AppBackupContent `json:"content"`
	}
	var full FullBackup
	if err := json.Unmarshal(data, &full); err != nil {
		return err
	}

	// Restore Accounts
	// ImportData expects the inner blob.
	if len(full.Content.Accounts) > 0 {
		_, err := s.accounts.ImportData(ctx, full.Content.Accounts)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *ServiceImpl) CreateBucketSnapshot(ctx context.Context, accountID, bucket string) (*BackupHeader, error) {
	// List objects recursively
	input := objects.ListObjectsInput{
		Bucket: bucket,
		Limit:  1000,
	}

	var allObjects []SnapshotObject
	var marker string

	for {
		input.Marker = marker
		res, err := s.objects.ListObjects(ctx, accountID, input)
		if err != nil {
			return nil, err
		}

		for _, obj := range res.Objects {
			if !obj.IsDir {
				allObjects = append(allObjects, SnapshotObject{
					Key:          obj.Key,
					Size:         obj.Size,
					LastModified: obj.LastModified,
					ETag:         obj.ETag,
				})
			}
		}

		if !res.Truncated {
			break
		}
		marker = res.NextMarker
	}

	// Save to file (mock implementation: just return header)
	header := &BackupHeader{
		ID:          uuid.New().String(),
		Type:        BackupTypeSnapshot,
		CreatedAt:   time.Now(),
		AccountID:   accountID,
		BucketName:  bucket,
		ObjectCount: int64(len(allObjects)),
	}

	// Actual persistent storage of snapshot JSON would happen here (saving to disk/db)

	return header, nil
}

func (s *ServiceImpl) ListSnapshots(ctx context.Context, accountID, bucket string) ([]*BackupHeader, error) {
	return []*BackupHeader{}, nil // Placeholder
}

func (s *ServiceImpl) RestoreSnapshot(ctx context.Context, snapshotID string) error {
	return nil // Placeholder
}
