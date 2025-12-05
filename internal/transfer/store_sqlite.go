package transfer

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// sqliteStore persists transfer tasks using SQLite via GORM.
type sqliteStore struct {
	db *gorm.DB
}

// NewSQLiteStore opens (and migrates) a SQLite database located at the provided path/DSN.
func NewSQLiteStore(dsn string) (Store, error) {
	dsn = strings.TrimSpace(dsn)
	if dsn == "" {
		return nil, fmt.Errorf("sqlite dsn is required")
	}
	if err := os.MkdirAll(filepath.Dir(dsn), 0o755); err != nil {
		return nil, fmt.Errorf("prepare sqlite directory: %w", err)
	}
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, fmt.Errorf("open sqlite database: %w", err)
	}
	if err := db.AutoMigrate(&taskRecord{}); err != nil {
		return nil, fmt.Errorf("auto migrate transfer tasks: %w", err)
	}
	return &sqliteStore{db: db}, nil
}

func (s *sqliteStore) Create(ctx context.Context, task *TransferTask) error {
	record, err := recordFromTask(task)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Create(record).Error
}

func (s *sqliteStore) Update(ctx context.Context, task *TransferTask) error {
	record, err := recordFromTask(task)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Save(record).Error
}

func (s *sqliteStore) Get(ctx context.Context, id string) (*TransferTask, error) {
	var record taskRecord
	if err := s.db.WithContext(ctx).First(&record, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrTaskNotFound
		}
		return nil, err
	}
	return record.toTask()
}

func (s *sqliteStore) List(ctx context.Context) ([]*TransferTask, error) {
	var records []taskRecord
	if err := s.db.WithContext(ctx).Order("start_time DESC").Find(&records).Error; err != nil {
		return nil, err
	}
	return mapRecords(records)
}

func (s *sqliteStore) ListByStatus(ctx context.Context, statuses ...TaskStatus) ([]*TransferTask, error) {
	var records []taskRecord
	query := s.db.WithContext(ctx).Order("start_time DESC")
	if len(statuses) > 0 {
		query = query.Where("status IN ?", statuses)
	}
	if err := query.Find(&records).Error; err != nil {
		return nil, err
	}
	return mapRecords(records)
}

func mapRecords(records []taskRecord) ([]*TransferTask, error) {
	tasks := make([]*TransferTask, 0, len(records))
	for i := range records {
		task, err := records[i].toTask()
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, nil
}
