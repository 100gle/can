package migration

import (
	"errors"
)

var (
	ErrJobNotFound = errors.New("migration job not found")
)

// JobStore defines persistence for migration jobs.
type JobStore interface {
	Save(job *MigrationJob) error
	Get(id string) (*MigrationJob, error)
	List() ([]*MigrationJob, error)
	Update(job *MigrationJob) error
	Delete(id string) error
}

// InMemoryJobStore is a simple in-memory implementation of JobStore.
type InMemoryJobStore struct {
	jobs map[string]*MigrationJob
}

func NewInMemoryJobStore() *InMemoryJobStore {
	return &InMemoryJobStore{
		jobs: make(map[string]*MigrationJob),
	}
}

func (s *InMemoryJobStore) Save(job *MigrationJob) error {
	s.jobs[job.ID] = job
	return nil
}

func (s *InMemoryJobStore) Get(id string) (*MigrationJob, error) {
	job, ok := s.jobs[id]
	if !ok {
		return nil, ErrJobNotFound
	}
	return job, nil
}

func (s *InMemoryJobStore) List() ([]*MigrationJob, error) {
	jobs := make([]*MigrationJob, 0, len(s.jobs))
	for _, job := range s.jobs {
		jobs = append(jobs, job)
	}
	return jobs, nil
}

func (s *InMemoryJobStore) Update(job *MigrationJob) error {
	if _, ok := s.jobs[job.ID]; !ok {
		return ErrJobNotFound
	}
	s.jobs[job.ID] = job
	return nil
}

func (s *InMemoryJobStore) Delete(id string) error {
	delete(s.jobs, id)
	return nil
}
