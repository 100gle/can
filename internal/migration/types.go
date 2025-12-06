package migration

import (
	"time"
)

// MigrationStatus represents the current state of a migration job.
type MigrationStatus string

const (
	StatusPending   MigrationStatus = "pending"
	StatusRunning   MigrationStatus = "running"
	StatusPaused    MigrationStatus = "paused"
	StatusCompleted MigrationStatus = "completed"
	StatusFailed    MigrationStatus = "failed"
	StatusCancelled MigrationStatus = "cancelled"
)

// MigrationJob represents a single data migration task.
type MigrationJob struct {
	ID          string           `json:"id"`
	Source      EndpointInfo     `json:"source"`
	Destination EndpointInfo     `json:"destination"`
	Options     MigrationOptions `json:"options"`
	Status      MigrationStatus  `json:"status"`
	Stats       MigrationStats   `json:"stats"`
	Error       string           `json:"error,omitempty"`
	CreatedAt   time.Time        `json:"created_at" ts_type:"string"`
	UpdatedAt   time.Time        `json:"updated_at" ts_type:"string"`
}

// EndpointInfo describes the source or destination of a migration.
type EndpointInfo struct {
	AccountID  string `json:"account_id"` // Links to internal/accounts
	BucketName string `json:"bucket_name"`
	Prefix     string `json:"prefix,omitempty"`
}

// MigrationOptions configuration for the migration job.
type MigrationOptions struct {
	DeleteSource   bool `json:"delete_source"`
	Overwrite      bool `json:"overwrite"`
	MaxConcurrency int  `json:"max_concurrency"`
}

// MigrationStats tracks the progress of a migration.
type MigrationStats struct {
	TotalObjects     int64 `json:"total_objects"`
	ProcessedObjects int64 `json:"processed_objects"` // Success + Failed + Skipped
	CopiedObjects    int64 `json:"copied_objects"`
	FailedObjects    int64 `json:"failed_objects"`
	SkippedObjects   int64 `json:"skipped_objects"`
	TotalBytes       int64 `json:"total_bytes"`
	ProcessedBytes   int64 `json:"processed_bytes"`
}
