package search

import (
	"context"
	"encoding/json"
	"time"
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
