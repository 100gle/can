package accounts

import (
	"context"
	"errors"
	"sort"
	"sync"
)

// Store defines persistence operations for storage accounts.
type Store interface {
	List(ctx context.Context) ([]StorageAccount, error)
	Get(ctx context.Context, id string) (StorageAccount, error)
	Save(ctx context.Context, account StorageAccount) error
	Update(ctx context.Context, account StorageAccount) error
	Delete(ctx context.Context, id string) error
	Count(ctx context.Context) (int, error)
}

// memoryStore offers an in-memory implementation for early iterations.
type memoryStore struct {
	mu       sync.RWMutex
	accounts map[string]StorageAccount
}

// NewMemoryStore returns a thread-safe in-memory account store.
func NewMemoryStore() Store {
	return &memoryStore{accounts: make(map[string]StorageAccount)}
}

func (m *memoryStore) List(_ context.Context) ([]StorageAccount, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]StorageAccount, 0, len(m.accounts))
	for _, acc := range m.accounts {
		out = append(out, acc)
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].Name < out[j].Name
	})
	return out, nil
}

func (m *memoryStore) Get(_ context.Context, id string) (StorageAccount, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	acc, ok := m.accounts[id]
	if !ok {
		return StorageAccount{}, errors.New("account not found")
	}
	return acc, nil
}

func (m *memoryStore) Save(_ context.Context, account StorageAccount) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.accounts[account.ID]; exists {
		return errors.New("account already exists")
	}
	m.accounts[account.ID] = account
	return nil
}

func (m *memoryStore) Update(_ context.Context, account StorageAccount) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.accounts[account.ID]; !exists {
		return errors.New("account not found")
	}
	m.accounts[account.ID] = account
	return nil
}

func (m *memoryStore) Delete(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.accounts, id)
	return nil
}

func (m *memoryStore) Count(_ context.Context) (int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.accounts), nil
}
