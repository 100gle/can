package app

import (
	"can/internal/migration"
)

// CreateMigrationJob starts a new data movement task configuration.
func (a *App) CreateMigrationJob(source, dest migration.EndpointInfo, options migration.MigrationOptions) (*migration.MigrationJob, error) {
	// ctx, cancel := a.backgroundContext()
	// defer cancel()
	// Usually service logic is mostly sync but saving to db.
	// We pass ctx if we update service to use context in CreateJob.
	// For now CreateJob doesn't take context in interface, but maybe it should have.
	// Assuming it's fast (in-memory).

	// Validating input could happen here or in service.
	return a.migration.CreateJob(source, dest, options)
}

// StartMigrationJob triggers the execution of a created job.
func (a *App) StartMigrationJob(jobID string) error {
	// StartJob launches a goroutine so it returns quickly.
	return a.migration.StartJob(jobID)
}

// GetMigrationJob retrieves full details of a job.
func (a *App) GetMigrationJob(jobID string) (*migration.MigrationJob, error) {
	return a.migration.GetJob(jobID)
}

// ListMigrationJobs returns history of all jobs.
func (a *App) ListMigrationJobs() ([]*migration.MigrationJob, error) {
	return a.migration.ListJobs()
}

// CancelMigrationJob stops a running job.
func (a *App) CancelMigrationJob(jobID string) error {
	return a.migration.CancelJob(jobID)
}

// PauseMigrationJob pauses a running job.
func (a *App) PauseMigrationJob(jobID string) error {
	return a.migration.PauseJob(jobID)
}
