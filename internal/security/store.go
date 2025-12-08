package security

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type SQLiteAuditStore struct {
	db *gorm.DB
}

// Ensure implementation
var _ AuditStore = (*SQLiteAuditStore)(nil)

func NewSQLiteAuditStore(path string) (*SQLiteAuditStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("prepare audit sqlite dir: %w", err)
	}
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}
	return &SQLiteAuditStore{db: db}, nil
}

func (s *SQLiteAuditStore) Init() error {
	return s.db.AutoMigrate(&AuditEvent{})
}

func (s *SQLiteAuditStore) Record(ctx context.Context, event AuditEvent) error {
	return s.db.WithContext(ctx).Create(&event).Error
}

func (s *SQLiteAuditStore) Query(ctx context.Context, filter AuditFilter) ([]AuditEvent, error) {
	stmt := s.db.WithContext(ctx).Model(&AuditEvent{})

	if filter.StartTime != nil {
		stmt = stmt.Where("timestamp >= ?", *filter.StartTime)
	}
	if filter.EndTime != nil {
		stmt = stmt.Where("timestamp <= ?", *filter.EndTime)
	}
	if filter.Action != "" {
		stmt = stmt.Where("action = ?", filter.Action)
	}
	if filter.Resource != "" {
		stmt = stmt.Where("resource LIKE ?", "%"+filter.Resource+"%")
	}

	stmt = stmt.Order("timestamp DESC")

	if filter.Limit > 0 {
		stmt = stmt.Limit(filter.Limit)
	}
	if filter.Offset > 0 {
		stmt = stmt.Offset(filter.Offset)
	}

	var events []AuditEvent
	err := stmt.Find(&events).Error
	return events, err
}

func (s *SQLiteAuditStore) HasRequest(ctx context.Context, requestID string) (bool, error) {
	id := strings.TrimSpace(requestID)
	if id == "" {
		return false, nil
	}
	var count int64
	err := s.db.WithContext(ctx).
		Model(&AuditEvent{}).
		Where("request_id = ? AND status = ?", id, "Success").
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}
