package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// ActiveSessionStore persists the last active account id to support session restore.
type ActiveSessionStore interface {
	Load(ctx context.Context) (string, error)
	Save(ctx context.Context, accountID string) error
	Clear(ctx context.Context) error
}

// fileSessionStore stores the active account id inside a small JSON file.
type fileSessionStore struct {
	path string
	mu   sync.Mutex
}

// NewFileSessionStore creates a file-backed session store rooted at the given path.
func NewFileSessionStore(path string) (ActiveSessionStore, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("session file path is required")
	}
	return &fileSessionStore{path: path}, nil
}

func (f *fileSessionStore) Load(_ context.Context) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	data, err := os.ReadFile(f.path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}
		return "", err
	}
	var payload struct {
		ActiveAccountID string `json:"activeAccountId"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return "", err
	}
	return strings.TrimSpace(payload.ActiveAccountID), nil
}

func (f *fileSessionStore) Save(_ context.Context, accountID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(f.path), 0o755); err != nil {
		return err
	}
	payload := struct {
		ActiveAccountID string `json:"activeAccountId"`
	}{
		ActiveAccountID: strings.TrimSpace(accountID),
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return err
	}
	tmp := f.path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, f.path)
}

func (f *fileSessionStore) Clear(_ context.Context) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if err := os.Remove(f.path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}

// memorySessionStore keeps the active account in memory, useful for tests.
type memorySessionStore struct {
	mu     sync.RWMutex
	active string
}

// NewMemorySessionStore returns an in-memory ActiveSessionStore implementation.
func NewMemorySessionStore() ActiveSessionStore {
	return &memorySessionStore{}
}

func (m *memorySessionStore) Load(_ context.Context) (string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.active, nil
}

func (m *memorySessionStore) Save(_ context.Context, accountID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.active = strings.TrimSpace(accountID)
	return nil
}

func (m *memorySessionStore) Clear(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.active = ""
	return nil
}
