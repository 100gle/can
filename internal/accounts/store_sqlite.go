package accounts

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

// sqliteStore persists accounts using GORM + SQLite for portability.
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
	if err := db.AutoMigrate(&StorageAccount{}); err != nil {
		return nil, fmt.Errorf("auto migrate accounts: %w", err)
	}
	return &sqliteStore{db: db}, nil
}

func (s *sqliteStore) List(ctx context.Context) ([]StorageAccount, error) {
	var records []StorageAccount
	if err := s.db.WithContext(ctx).Order("name ASC").Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (s *sqliteStore) Get(ctx context.Context, id string) (StorageAccount, error) {
	var record StorageAccount
	if err := s.db.WithContext(ctx).First(&record, "id = ?", id).Error; err != nil {
		return StorageAccount{}, err
	}
	return record, nil
}

func (s *sqliteStore) Save(ctx context.Context, account StorageAccount) error {
	return s.db.WithContext(ctx).Create(&account).Error
}

func (s *sqliteStore) Update(ctx context.Context, account StorageAccount) error {
	return s.db.WithContext(ctx).Save(&account).Error
}

func (s *sqliteStore) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Delete(&StorageAccount{}, "id = ?", id).Error
}

func (s *sqliteStore) Count(ctx context.Context) (int, error) {
	var count int64
	if err := s.db.WithContext(ctx).Model(&StorageAccount{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}
