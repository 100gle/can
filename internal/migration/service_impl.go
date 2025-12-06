package migration

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

type ServiceImpl struct {
	store    JobStore
	migrator Migrator
	mu       sync.Mutex
	// runningJobs tracks active cancellation contexts for running jobs
	runningJobs map[string]context.CancelFunc
}

func NewService(store JobStore, migrator Migrator) *ServiceImpl {
	return &ServiceImpl{
		store:       store,
		migrator:    migrator,
		runningJobs: make(map[string]context.CancelFunc),
	}
}

func (s *ServiceImpl) CreateJob(source, dest EndpointInfo, options MigrationOptions) (*MigrationJob, error) {
	job := &MigrationJob{
		ID:          uuid.New().String(),
		Source:      source,
		Destination: dest,
		Options:     options,
		Status:      StatusPending,
		Stats:       MigrationStats{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.store.Save(job); err != nil {
		return nil, err
	}

	return job, nil
}

func (s *ServiceImpl) StartJob(jobID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, err := s.store.Get(jobID)
	if err != nil {
		return err
	}

	if job.Status == StatusRunning {
		return fmt.Errorf("job is already running")
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.runningJobs[jobID] = cancel

	job.Status = StatusRunning
	job.UpdatedAt = time.Now()
	if err := s.store.Update(job); err != nil {
		return err
	}

	// Run migration in a goroutine
	go func(j *MigrationJob) {
		defer func() {
			s.mu.Lock()
			delete(s.runningJobs, j.ID)
			s.mu.Unlock()
		}()

		progressCallback := func(stats MigrationStats) {
			s.mu.Lock()
			// Reload job to avoid overwriting other fields if we had them,
			// but for now we trust the flow. Ideally we should lock the specific job.
			// Re-fetching is safer for concurrent updates if we had them.
			currentJob, err := s.store.Get(j.ID)
			if err == nil {
				currentJob.Stats = stats
				currentJob.UpdatedAt = time.Now()
				s.store.Update(currentJob)
			}
			s.mu.Unlock()
		}

		err := s.migrator.Migrate(ctx, j, progressCallback)

		s.mu.Lock()
		defer s.mu.Unlock()

		// Refresh job
		currentJob, _ := s.store.Get(j.ID)
		if currentJob == nil {
			return
		}

		currentJob.UpdatedAt = time.Now()
		if err != nil {
			if errors.Is(err, context.Canceled) {
				currentJob.Status = StatusCancelled
			} else {
				currentJob.Status = StatusFailed
				currentJob.Error = err.Error()
			}
		} else {
			currentJob.Status = StatusCompleted
		}
		s.store.Update(currentJob)

	}(job)

	return nil
}

func (s *ServiceImpl) PauseJob(jobID string) error {
	// For now, pause is effectively cancel with a different status,
	// or we just cancel context and mark as Paused.
	return s.cancelWithStatus(jobID, StatusPaused)
}

func (s *ServiceImpl) CancelJob(jobID string) error {
	return s.cancelWithStatus(jobID, StatusCancelled)
}

func (s *ServiceImpl) cancelWithStatus(jobID string, status MigrationStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	cancel, ok := s.runningJobs[jobID]
	if ok {
		cancel()
	}

	job, err := s.store.Get(jobID)
	if err != nil {
		return err
	}

	job.Status = status
	job.UpdatedAt = time.Now()
	return s.store.Update(job)
}

func (s *ServiceImpl) GetJob(jobID string) (*MigrationJob, error) {
	return s.store.Get(jobID)
}

func (s *ServiceImpl) ListJobs() ([]*MigrationJob, error) {
	return s.store.List()
}
