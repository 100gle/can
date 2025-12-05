package transfer

import (
	"context"
	"sort"
	"sync"
)

// memoryStore is a simple in-memory implementation used in tests.
type memoryStore struct {
	mu    sync.RWMutex
	tasks map[string]*TransferTask
}

// NewMemoryStore creates an in-memory transfer store.
func NewMemoryStore() Store {
	return &memoryStore{
		tasks: make(map[string]*TransferTask),
	}
}

func (s *memoryStore) Create(_ context.Context, task *TransferTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tasks[task.ID] = task.clone()
	return nil
}

func (s *memoryStore) Update(_ context.Context, task *TransferTask) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tasks[task.ID] = task.clone()
	return nil
}

func (s *memoryStore) Get(_ context.Context, id string) (*TransferTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	task, ok := s.tasks[id]
	if !ok {
		return nil, ErrTaskNotFound
	}
	return task.clone(), nil
}

func (s *memoryStore) List(_ context.Context) ([]*TransferTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.exportLocked()
}

func (s *memoryStore) ListByStatus(_ context.Context, statuses ...TaskStatus) ([]*TransferTask, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if len(statuses) == 0 {
		return s.exportLocked()
	}
	set := make(map[TaskStatus]struct{}, len(statuses))
	for _, status := range statuses {
		set[status] = struct{}{}
	}
	tasks := make([]*TransferTask, 0, len(s.tasks))
	for _, task := range s.tasks {
		if _, ok := set[task.Status]; !ok {
			continue
		}
		tasks = append(tasks, task.clone())
	}
	sort.Slice(tasks, func(i, j int) bool {
		return tasks[i].StartTime.After(tasks[j].StartTime)
	})
	return tasks, nil
}

func (s *memoryStore) exportLocked() ([]*TransferTask, error) {
	tasks := make([]*TransferTask, 0, len(s.tasks))
	for _, task := range s.tasks {
		tasks = append(tasks, task.clone())
	}
	sort.Slice(tasks, func(i, j int) bool {
		return tasks[i].StartTime.After(tasks[j].StartTime)
	})
	return tasks, nil
}
