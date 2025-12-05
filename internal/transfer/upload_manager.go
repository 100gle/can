package transfer

import "sync"

// UploadManager keeps in-memory upload task state.
type UploadManager struct {
	mu    sync.RWMutex
	tasks map[string]*TransferTask
}

// NewUploadManager returns a prepared upload manager.
func NewUploadManager() *UploadManager {
	return &UploadManager{
		tasks: make(map[string]*TransferTask),
	}
}

// Add inserts or replaces a task.
func (m *UploadManager) Add(task *TransferTask) {
	if task == nil || task.ID == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tasks[task.ID] = task
}

// Get returns a task by ID.
func (m *UploadManager) Get(id string) (*TransferTask, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	task, ok := m.tasks[id]
	return task, ok
}

// Remove deletes the task from the manager.
func (m *UploadManager) Remove(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.tasks, id)
}

// List returns all uploads without cloning.
func (m *UploadManager) List() []*TransferTask {
	m.mu.RLock()
	defer m.mu.RUnlock()
	items := make([]*TransferTask, 0, len(m.tasks))
	for _, task := range m.tasks {
		items = append(items, task)
	}
	return items
}

// Update applies a mutation callback inside the lock.
func (m *UploadManager) Update(id string, fn func(task *TransferTask)) (*TransferTask, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	task, ok := m.tasks[id]
	if !ok {
		return nil, false
	}
	if fn != nil {
		fn(task)
	}
	return task, true
}
