package backup

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// SnapshotStore persists snapshot metadata and content to the filesystem.
type SnapshotStore struct {
	mu      sync.RWMutex
	dataDir string
}

// NewSnapshotStore creates a store rooted at the given data directory.
func NewSnapshotStore(dataDir string) *SnapshotStore {
	return &SnapshotStore{dataDir: dataDir}
}

// snapshotDir returns the directory for storing snapshot files.
func (s *SnapshotStore) snapshotDir() string {
	return filepath.Join(s.dataDir, "snapshots")
}

// headerFilePath returns the path to the snapshot metadata file.
func (s *SnapshotStore) headerFilePath(id string) string {
	return filepath.Join(s.snapshotDir(), id+".meta.json")
}

// contentFilePath returns the path to the snapshot object list file.
func (s *SnapshotStore) contentFilePath(id string) string {
	return filepath.Join(s.snapshotDir(), id+".objects.json")
}

// EnsureDir creates the snapshot directory if it doesn't exist.
func (s *SnapshotStore) EnsureDir() error {
	return os.MkdirAll(s.snapshotDir(), 0755)
}

// SaveSnapshot persists a snapshot header and its object list.
func (s *SnapshotStore) SaveSnapshot(header *BackupHeader, objects []SnapshotObject) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.EnsureDir(); err != nil {
		return err
	}

	// Save header
	headerBytes, err := json.MarshalIndent(header, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(s.headerFilePath(header.ID), headerBytes, 0644); err != nil {
		return err
	}

	// Save content
	content := SnapshotContent{Objects: objects}
	contentBytes, err := json.Marshal(content)
	if err != nil {
		return err
	}
	return os.WriteFile(s.contentFilePath(header.ID), contentBytes, 0644)
}

// ListSnapshots returns all snapshot headers, optionally filtered by account and bucket.
func (s *SnapshotStore) ListSnapshots(accountID, bucket string) ([]*BackupHeader, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	dir := s.snapshotDir()
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return []*BackupHeader{}, nil
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var result []*BackupHeader
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		// Only read .meta.json files
		if len(entry.Name()) < 10 || entry.Name()[len(entry.Name())-10:] != ".meta.json" {
			continue
		}

		data, err := os.ReadFile(filepath.Join(dir, entry.Name()))
		if err != nil {
			continue
		}
		var header BackupHeader
		if err := json.Unmarshal(data, &header); err != nil {
			continue
		}

		// Filter by account and bucket if provided
		if accountID != "" && header.AccountID != accountID {
			continue
		}
		if bucket != "" && header.BucketName != bucket {
			continue
		}
		result = append(result, &header)
	}

	return result, nil
}

// GetSnapshot retrieves a single snapshot header by ID.
func (s *SnapshotStore) GetSnapshot(id string) (*BackupHeader, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.headerFilePath(id))
	if err != nil {
		return nil, err
	}
	var header BackupHeader
	if err := json.Unmarshal(data, &header); err != nil {
		return nil, err
	}
	return &header, nil
}

// GetSnapshotContent retrieves the object list for a snapshot.
func (s *SnapshotStore) GetSnapshotContent(id string) (*SnapshotContent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.contentFilePath(id))
	if err != nil {
		return nil, err
	}
	var content SnapshotContent
	if err := json.Unmarshal(data, &content); err != nil {
		return nil, err
	}
	return &content, nil
}

// DeleteSnapshot removes a snapshot by ID.
func (s *SnapshotStore) DeleteSnapshot(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_ = os.Remove(s.headerFilePath(id))
	_ = os.Remove(s.contentFilePath(id))
	return nil
}
