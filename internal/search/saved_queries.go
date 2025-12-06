package search

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// SavedQuery represents a persisted search configuration.
type SavedQuery struct {
	ID        string       `json:"id"`
	Name      string       `json:"name"`
	Query     *SearchQuery `json:"query"`
	CreatedAt time.Time    `json:"createdAt" ts_type:"string"`
	UpdatedAt time.Time    `json:"updatedAt" ts_type:"string"`
}

// SavedQueryStore provides persistence for saved search queries.
type SavedQueryStore interface {
	// Create persists a new saved query. The implementation MUST set the ID field
	// on the query if it is empty, as callers rely on this behavior.
	Create(ctx context.Context, query *SavedQuery) error
	Get(ctx context.Context, id string) (*SavedQuery, error)
	List(ctx context.Context) ([]*SavedQuery, error)
	Update(ctx context.Context, query *SavedQuery) error
	Delete(ctx context.Context, id string) error
}

// MemorySavedQueryStore is an in-memory implementation of SavedQueryStore.
type MemorySavedQueryStore struct {
	mu      sync.RWMutex
	queries map[string]*SavedQuery
}

// NewMemorySavedQueryStore creates a new in-memory saved query store.
func NewMemorySavedQueryStore() *MemorySavedQueryStore {
	return &MemorySavedQueryStore{
		queries: make(map[string]*SavedQuery),
	}
}

func (s *MemorySavedQueryStore) Create(ctx context.Context, query *SavedQuery) error {
	if query == nil {
		return errors.New("query is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if query.ID == "" {
		query.ID = uuid.NewString()
	}
	now := time.Now()
	query.CreatedAt = now
	query.UpdatedAt = now
	s.queries[query.ID] = query
	return nil
}

func (s *MemorySavedQueryStore) Get(ctx context.Context, id string) (*SavedQuery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	query, ok := s.queries[id]
	if !ok {
		return nil, errors.New("saved query not found")
	}
	return query, nil
}

func (s *MemorySavedQueryStore) List(ctx context.Context) ([]*SavedQuery, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*SavedQuery, 0, len(s.queries))
	for _, query := range s.queries {
		result = append(result, query)
	}
	return result, nil
}

func (s *MemorySavedQueryStore) Update(ctx context.Context, query *SavedQuery) error {
	if query == nil || query.ID == "" {
		return errors.New("query with id is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.queries[query.ID]; !ok {
		return errors.New("saved query not found")
	}
	query.UpdatedAt = time.Now()
	s.queries[query.ID] = query
	return nil
}

func (s *MemorySavedQueryStore) Delete(ctx context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.queries, id)
	return nil
}

// MarshalQuery serializes a SearchQuery to JSON bytes for storage.
func MarshalQuery(query *SearchQuery) ([]byte, error) {
	return json.Marshal(query)
}

// UnmarshalQuery deserializes JSON bytes back to a SearchQuery.
func UnmarshalQuery(data []byte) (*SearchQuery, error) {
	var query SearchQuery
	if err := json.Unmarshal(data, &query); err != nil {
		return nil, err
	}
	return &query, nil
}
