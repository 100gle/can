package objects

import (
	"context"
	"errors"
	"sort"
	"sync"
	"time"
)

// LinkHistoryStore keeps track of generated presigned links.
type LinkHistoryStore interface {
	Save(ctx context.Context, entry *LinkHistoryEntry) error
	List(ctx context.Context, accountID string, limit int) ([]LinkHistoryEntry, error)
	Delete(ctx context.Context, accountID, id string) error
	Cleanup(ctx context.Context, cutoff time.Time) error
}

// NewMemoryLinkHistoryStore returns an in-memory implementation suitable for tests.
func NewMemoryLinkHistoryStore() LinkHistoryStore {
	return &memoryLinkStore{
		entries: make(map[string]LinkHistoryEntry),
	}
}

type memoryLinkStore struct {
	mu      sync.RWMutex
	entries map[string]LinkHistoryEntry
}

func (s *memoryLinkStore) Save(_ context.Context, entry *LinkHistoryEntry) error {
	if entry == nil || entry.ID == "" {
		return errors.New("invalid history entry")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	copy := *entry
	s.entries[entry.ID] = copy
	return nil
}

func (s *memoryLinkStore) List(_ context.Context, accountID string, limit int) ([]LinkHistoryEntry, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	items := make([]LinkHistoryEntry, 0, len(s.entries))
	for _, entry := range s.entries {
		if entry.AccountID != accountID {
			continue
		}
		items = append(items, entry)
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt.After(items[j].CreatedAt)
	})
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

func (s *memoryLinkStore) Delete(_ context.Context, accountID, id string) error {
	if id == "" {
		return errors.New("id is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.entries[id]
	if !ok {
		return nil
	}
	if entry.AccountID != accountID {
		return errors.New("link does not belong to this account")
	}
	delete(s.entries, id)
	return nil
}

func (s *memoryLinkStore) Cleanup(_ context.Context, cutoff time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for id, entry := range s.entries {
		if !entry.ExpiresAt.IsZero() && entry.ExpiresAt.Before(cutoff) {
			delete(s.entries, id)
		}
	}
	return nil
}
