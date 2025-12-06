package app

import "can/internal/search"

// SearchObjects performs bucket-wide search with filters.
func (a *App) SearchObjects(accountID string, query *search.SearchQuery) (*search.SearchResponse, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.SearchObjects(ctx, accountID, query)
}

// ExportSearchResults exports search outcomes into csv/json formats.
func (a *App) ExportSearchResults(accountID string, query *search.SearchQuery, format string) ([]byte, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.ExportSearchResults(ctx, accountID, query, format)
}

// SaveSearchQuery persists a search query configuration with the given name.
func (a *App) SaveSearchQuery(name string, query *search.SearchQuery) (*search.SavedQuery, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.SaveQuery(ctx, name, query)
}

// ListSavedSearchQueries returns all saved search queries.
func (a *App) ListSavedSearchQueries() ([]*search.SavedQuery, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.ListSavedQueries(ctx)
}

// DeleteSavedSearchQuery removes a saved query by ID.
func (a *App) DeleteSavedSearchQuery(id string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.DeleteSavedQuery(ctx, id)
}

// UpdateSavedSearchQuery updates an existing saved query's name and/or query configuration.
func (a *App) UpdateSavedSearchQuery(id string, name string, query *search.SearchQuery) (*search.SavedQuery, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.UpdateSavedQuery(ctx, id, name, query)
}
