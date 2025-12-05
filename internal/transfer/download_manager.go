package transfer

import "sync"

// DownloadManager keeps active download tasks.
type DownloadManager struct {
	mu    sync.RWMutex
	tasks map[string]*TransferTask
}

// NewDownloadManager builds a download manager.
func NewDownloadManager() *DownloadManager {
	return &DownloadManager{
		tasks: make(map[string]*TransferTask),
	}
}

// Add inserts or replaces a task.
func (m *DownloadManager) Add(task *TransferTask) {
	if task == nil || task.ID == "" {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.tasks[task.ID] = task
}

// Get fetches a task by ID.
func (m *DownloadManager) Get(id string) (*TransferTask, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	task, ok := m.tasks[id]
	return task, ok
}

// Remove deletes a task from the manager.
func (m *DownloadManager) Remove(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.tasks, id)
}

// List returns all download tasks.
func (m *DownloadManager) List() []*TransferTask {
	m.mu.RLock()
	defer m.mu.RUnlock()
	items := make([]*TransferTask, 0, len(m.tasks))
	for _, task := range m.tasks {
		items = append(items, task)
	}
	return items
}

// Update mutates a task within the lock.
func (m *DownloadManager) Update(id string, fn func(task *TransferTask)) (*TransferTask, bool) {
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
