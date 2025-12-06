package backup

import (
	"time"
)

// BackupType differentiates between app config backup and bucket snapshot.
type BackupType string

const (
	BackupTypeAppConfig BackupType = "app_config"
	BackupTypeSnapshot  BackupType = "snapshot"
)

// BackupHeader contains metadata about the backup.
type BackupHeader struct {
	ID        string     `json:"id"`
	Type      BackupType `json:"type"`
	CreatedAt time.Time  `json:"created_at" ts_type:"string"`
	Version   string     `json:"version"` // App Version
	Encrypted bool       `json:"encrypted"`

	// Snapshot specific
	AccountID   string `json:"account_id,omitempty"`
	BucketName  string `json:"bucket_name,omitempty"`
	ObjectCount int64  `json:"object_count,omitempty"`
}

// AppBackupContent represents the payload for application backup.
type AppBackupContent struct {
	Settings  []byte `json:"settings"`  // JSON content
	Accounts  []byte `json:"accounts"`  // Encrypted content or JSON
	Favorites []byte `json:"favorites"` // JSON content
}

// SnapshotContent represents the payload for bucket snapshot (object listing).
// We might store this as a large JSON list.
type SnapshotContent struct {
	Objects []SnapshotObject `json:"objects"`
}

type SnapshotObject struct {
	Key          string    `json:"key"`
	Size         int64     `json:"size"`
	LastModified time.Time `json:"last_modified" ts_type:"string"`
	ETag         string    `json:"etag"`
}
