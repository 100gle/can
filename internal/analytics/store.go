package analytics

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Store interface {
	RecordUsage(ctx context.Context, provider string, upload, download int64, requests int) error
	GetUsage(ctx context.Context, start, end time.Time) ([]UsageRecord, error)
	GetDailyUsage(ctx context.Context, date time.Time) ([]UsageRecord, error)
	Init() error
}

type SQLiteStore struct {
	db *gorm.DB
}

// Ensure implementation
var _ Store = (*SQLiteStore)(nil)

// UsageRecordEntity mirrors UsageRecord for database mapping with GORM
type UsageRecordEntity struct {
	Date          string `gorm:"primaryKey"` // YYYY-MM-DD
	Provider      string `gorm:"primaryKey"`
	UploadBytes   int64
	DownloadBytes int64
	RequestCount  int64
}

func (e *UsageRecordEntity) TableName() string {
	return "analytics_usage"
}

func NewSQLiteStore(db *gorm.DB) *SQLiteStore {
	return &SQLiteStore{db: db}
}

func NewSQLiteStoreFromFile(path string) (*SQLiteStore, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, fmt.Errorf("prepare sqlite directory: %w", err)
	}
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return nil, err
	}
	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) Init() error {
	return s.db.AutoMigrate(&UsageRecordEntity{})
}

func (s *SQLiteStore) RecordUsage(ctx context.Context, provider string, upload, download int64, requests int) error {
	date := time.Now().Format("2006-01-02")
	// We want to increment values. GORM generic Upsert usually replaces.
	// For increment, we might need a raw query or separate logic.
	// Using raw Exec is safer for atomic increments.
	query := `
	INSERT INTO analytics_usage (date, provider, upload_bytes, download_bytes, request_count)
	VALUES (?, ?, ?, ?, ?)
	ON CONFLICT(date, provider) DO UPDATE SET
		upload_bytes = upload_bytes + excluded.upload_bytes,
		download_bytes = download_bytes + excluded.download_bytes,
		request_count = request_count + excluded.request_count;
	`
	return s.db.WithContext(ctx).Exec(query, date, provider, upload, download, requests).Error
}

func (s *SQLiteStore) GetUsage(ctx context.Context, start, end time.Time) ([]UsageRecord, error) {
	var entities []UsageRecordEntity
	sDate := start.Format("2006-01-02")
	eDate := end.Format("2006-01-02")

	err := s.db.WithContext(ctx).
		Where("date >= ? AND date <= ?", sDate, eDate).
		Order("date ASC").
		Find(&entities).Error

	if err != nil {
		return nil, err
	}

	records := make([]UsageRecord, len(entities))
	for i, e := range entities {
		records[i] = UsageRecord{
			Date:          e.Date,
			Provider:      e.Provider,
			UploadBytes:   e.UploadBytes,
			DownloadBytes: e.DownloadBytes,
			RequestCount:  e.RequestCount,
		}
	}
	return records, nil
}

func (s *SQLiteStore) GetDailyUsage(ctx context.Context, date time.Time) ([]UsageRecord, error) {
	return s.GetUsage(ctx, date, date)
}
