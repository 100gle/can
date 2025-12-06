package search

import (
	"context"
	"testing"
)

func TestMemorySavedQueryStore_CRUD(t *testing.T) {
	store := NewMemorySavedQueryStore()
	ctx := context.Background()

	// Create
	query := &SavedQuery{
		Name: "Test Query",
		Query: &SearchQuery{
			Bucket:     "my-bucket",
			Prefix:     "logs/",
			SearchText: "error",
		},
	}
	if err := store.Create(ctx, query); err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	if query.ID == "" {
		t.Error("Expected ID to be set after create")
	}
	if query.CreatedAt.IsZero() {
		t.Error("Expected CreatedAt to be set")
	}

	// Get
	fetched, err := store.Get(ctx, query.ID)
	if err != nil {
		t.Fatalf("Get failed: %v", err)
	}
	if fetched.Name != query.Name {
		t.Errorf("Expected name %q, got %q", query.Name, fetched.Name)
	}
	if fetched.Query.Bucket != "my-bucket" {
		t.Errorf("Expected bucket %q, got %q", "my-bucket", fetched.Query.Bucket)
	}

	// List
	list, err := store.List(ctx)
	if err != nil {
		t.Fatalf("List failed: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 query, got %d", len(list))
	}

	// Update
	query.Name = "Updated Query"
	if err := store.Update(ctx, query); err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	fetched, _ = store.Get(ctx, query.ID)
	if fetched.Name != "Updated Query" {
		t.Errorf("Expected updated name, got %q", fetched.Name)
	}

	// Delete
	if err := store.Delete(ctx, query.ID); err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
	list, _ = store.List(ctx)
	if len(list) != 0 {
		t.Errorf("Expected empty list after delete, got %d", len(list))
	}
}

func TestMemorySavedQueryStore_GetNotFound(t *testing.T) {
	store := NewMemorySavedQueryStore()
	ctx := context.Background()

	_, err := store.Get(ctx, "non-existent-id")
	if err == nil {
		t.Error("Expected error for non-existent query")
	}
}

func TestMemorySavedQueryStore_UpdateNotFound(t *testing.T) {
	store := NewMemorySavedQueryStore()
	ctx := context.Background()

	query := &SavedQuery{
		ID:   "non-existent-id",
		Name: "Test",
	}
	err := store.Update(ctx, query)
	if err == nil {
		t.Error("Expected error for updating non-existent query")
	}
}

func TestSaveQuery_Validation(t *testing.T) {
	svc := NewService(nil, nil, nil)
	ctx := context.Background()

	// Empty name
	_, err := svc.SaveQuery(ctx, "", &SearchQuery{})
	if err == nil {
		t.Error("Expected error for empty name")
	}

	// Nil query
	_, err = svc.SaveQuery(ctx, "Test", nil)
	if err == nil {
		t.Error("Expected error for nil query")
	}
}

func TestDeleteSavedQuery_Validation(t *testing.T) {
	svc := NewService(nil, nil, nil)
	ctx := context.Background()

	err := svc.DeleteSavedQuery(ctx, "")
	if err == nil {
		t.Error("Expected error for empty id")
	}
}

func TestServiceSavedQueries_Integration(t *testing.T) {
	svc := NewService(nil, nil, nil)
	ctx := context.Background()

	// Save a query
	query := &SearchQuery{
		Bucket:     "test-bucket",
		SearchText: "important",
		MinSize:    1024,
	}
	saved, err := svc.SaveQuery(ctx, "Important Files", query)
	if err != nil {
		t.Fatalf("SaveQuery failed: %v", err)
	}
	if saved.ID == "" {
		t.Error("Expected ID to be set")
	}

	// List queries
	list, err := svc.ListSavedQueries(ctx)
	if err != nil {
		t.Fatalf("ListSavedQueries failed: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("Expected 1 saved query, got %d", len(list))
	}
	if list[0].Name != "Important Files" {
		t.Errorf("Expected name 'Important Files', got %q", list[0].Name)
	}

	// Delete query
	if err := svc.DeleteSavedQuery(ctx, saved.ID); err != nil {
		t.Fatalf("DeleteSavedQuery failed: %v", err)
	}

	// Verify deleted
	list, _ = svc.ListSavedQueries(ctx)
	if len(list) != 0 {
		t.Errorf("Expected empty list after delete, got %d", len(list))
	}
}
