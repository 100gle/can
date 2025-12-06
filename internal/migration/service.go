package migration

import (
	"context"
)

// Service defines the interface for managing migration jobs.
type Service interface {
	// CreateJob creates a new migration job.
	CreateJob(source, dest EndpointInfo, options MigrationOptions) (*MigrationJob, error)

	// StartJob starts or resumes a migration job.
	StartJob(jobID string) error

	// PauseJob pauses a running migration job.
	PauseJob(jobID string) error

	// CancelJob cancels a migration job.
	CancelJob(jobID string) error

	// GetJob retrieves a job by its ID.
	GetJob(jobID string) (*MigrationJob, error)

	// ListJobs returns all migration jobs.
	ListJobs() ([]*MigrationJob, error)
}

// Migrator defines the interface for the actual data transfer logic.
// Different implementations can handle local-to-remote, remote-to-remote (if supported), etc.
type Migrator interface {
	// Migrate copies objects from source to destination based on the provided options.
	// It should update the job status and stats via a callback or channel.
	Migrate(ctx context.Context, job *MigrationJob, progressCallback func(stats MigrationStats)) error
}
