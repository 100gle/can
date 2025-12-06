package search

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// sqliteStore persists saved queries using GORM + SQLite.
type sqliteStore struct {
	db *gorm.DB
}

// sqlSavedQuery is the database model for a SavedQuery.
type sqlSavedQuery struct {
	ID        string `gorm:"primaryKey"`
	Name      string
	QueryJSON []byte
	CreatedAt int64
	UpdatedAt int64
}

// TableName overrides the default table name.
func (sqlSavedQuery) TableName() string {
	return "saved_queries"
}

// NewSQLiteStore creates or opens the SQLite database for saved queries.
func NewSQLiteStore(dsn string) (SavedQueryStore, error) {
	dsn = strings.TrimSpace(dsn)
	if dsn == "" {
		return nil, errors.New("sqlite dsn is required")
	}
	if err := os.MkdirAll(filepath.Dir(dsn), 0o755); err != nil {
		return nil, fmt.Errorf("prepare sqlite directory: %w", err)
	}
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}
	if err := db.AutoMigrate(&sqlSavedQuery{}); err != nil {
		return nil, fmt.Errorf("auto migrate saved_queries: %w", err)
	}
	return &sqliteStore{db: db}, nil
}

func (s *sqliteStore) Create(ctx context.Context, query *SavedQuery) error {
	if query == nil {
		return errors.New("query is required")
	}
	if query.ID == "" {
		query.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	if query.CreatedAt.IsZero() {
		query.CreatedAt = now
	}
	if query.UpdatedAt.IsZero() {
		query.UpdatedAt = now
	}
	jsonBytes, err := MarshalQuery(query.Query)
	if err != nil {
		return fmt.Errorf("marshal query: %w", err)
	}
	record := sqlSavedQuery{
		ID:        query.ID,
		Name:      query.Name,
		QueryJSON: jsonBytes,
		CreatedAt: query.CreatedAt.Unix(),
		UpdatedAt: query.UpdatedAt.Unix(),
	}
	return s.db.WithContext(ctx).Create(&record).Error
}

func (s *sqliteStore) Get(ctx context.Context, id string) (*SavedQuery, error) {
	var record sqlSavedQuery
	if err := s.db.WithContext(ctx).First(&record, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return s.toDomain(&record)
}

func (s *sqliteStore) List(ctx context.Context) ([]*SavedQuery, error) {
	var records []sqlSavedQuery
	if err := s.db.WithContext(ctx).Order("name ASC").Find(&records).Error; err != nil {
		return nil, err
	}
	results := make([]*SavedQuery, len(records))
	for i, r := range records {
		q, err := s.toDomain(&r)
		if err != nil {
			// Skip malformed records? Or fail? Let's skip and log in a real app,
			// but here we just error out to be safe or return what we can?
			// For robustness, let's return error but maybe we should just skip.
			// Let's assume database integrity.
			return nil, err
		}
		results[i] = q
	}
	return results, nil
}

func (s *sqliteStore) Update(ctx context.Context, query *SavedQuery) error {
	if query == nil {
		return errors.New("query is required")
	}
	// Verify exists
	var count int64
	if err := s.db.WithContext(ctx).Model(&sqlSavedQuery{}).Where("id = ?", query.ID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return errors.New("saved query not found")
	}

	jsonBytes, err := MarshalQuery(query.Query)
	if err != nil {
		return fmt.Errorf("marshal query: %w", err)
	}

	// We only update fields that can change. CreatedAt should not change.
	updates := map[string]interface{}{
		"name":       query.Name,
		"query_json": jsonBytes,
		"updated_at": query.UpdatedAt.Unix(),
	}
	return s.db.WithContext(ctx).Model(&sqlSavedQuery{}).Where("id = ?", query.ID).Updates(updates).Error
}

func (s *sqliteStore) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Delete(&sqlSavedQuery{}, "id = ?", id).Error
}

func (s *sqliteStore) toDomain(record *sqlSavedQuery) (*SavedQuery, error) {
	var q SearchQuery
	if err := json.Unmarshal(record.QueryJSON, &q); err != nil {
		return nil, fmt.Errorf("unmarshal query json: %w", err)
	}
	// Normalize times
	createdAt := unixToTime(record.CreatedAt)
	updatedAt := unixToTime(record.UpdatedAt)

	return &SavedQuery{
		ID:        record.ID,
		Name:      record.Name,
		Query:     &q,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}, nil
}

func unixToTime(sec int64) time.Time {
	return time.Unix(sec, 0).UTC()
}
