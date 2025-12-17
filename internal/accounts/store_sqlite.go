package accounts

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// sqliteStore persists accounts using GORM + SQLite for portability.
type sqliteStore struct {
	db *gorm.DB
}

// NewSQLiteStore creates a new store using the provided GORM database connection.
func NewSQLiteStore(db *gorm.DB) (Store, error) {
	if db == nil {
		return nil, fmt.Errorf("db is required")
	}
	if err := db.AutoMigrate(&accountRecord{}); err != nil {
		return nil, fmt.Errorf("auto migrate accounts: %w", err)
	}
	return &sqliteStore{db: db}, nil
}

func (s *sqliteStore) List(ctx context.Context) ([]accountRecord, error) {
	var records []accountRecord
	if err := s.db.WithContext(ctx).Order("name ASC").Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (s *sqliteStore) Get(ctx context.Context, id string) (accountRecord, error) {
	var record accountRecord
	if err := s.db.WithContext(ctx).First(&record, "id = ?", id).Error; err != nil {
		return accountRecord{}, err
	}
	return record, nil
}

func (s *sqliteStore) Save(ctx context.Context, account accountRecord) error {
	return s.db.WithContext(ctx).Create(&account).Error
}

func (s *sqliteStore) Update(ctx context.Context, account accountRecord) error {
	return s.db.WithContext(ctx).Save(&account).Error
}

func (s *sqliteStore) Delete(ctx context.Context, id string) error {
	return s.db.WithContext(ctx).Delete(&accountRecord{}, "id = ?", id).Error
}

func (s *sqliteStore) Count(ctx context.Context) (int, error) {
	var count int64
	if err := s.db.WithContext(ctx).Model(&accountRecord{}).Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}
