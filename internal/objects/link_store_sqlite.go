package objects

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// NewSQLiteLinkHistoryStore persists link history using SQLite.
func NewSQLiteLinkHistoryStore(dsn string) (LinkHistoryStore, error) {
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
	if err := db.AutoMigrate(&linkRecord{}); err != nil {
		return nil, fmt.Errorf("auto migrate link history: %w", err)
	}
	return &sqliteLinkStore{db: db}, nil
}

type sqliteLinkStore struct {
	db *gorm.DB
}

type linkRecord struct {
	ID        string    `gorm:"primaryKey;size:64"`
	AccountID string    `gorm:"size:128;index"`
	Bucket    string    `gorm:"size:512"`
	Key       string    `gorm:"size:2048"`
	Method    string    `gorm:"size:16"`
	URL       string    `gorm:"type:text"`
	FileName  string    `gorm:"size:1024"`
	ExpiresAt time.Time `gorm:"index"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
	Headers   []byte    `gorm:"type:text"`
}

func (s *sqliteLinkStore) Save(ctx context.Context, entry *LinkHistoryEntry) error {
	record, err := recordFromEntry(entry)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Save(record).Error
}

func (s *sqliteLinkStore) List(ctx context.Context, accountID string, limit int) ([]LinkHistoryEntry, error) {
	var records []linkRecord
	query := s.db.WithContext(ctx).Where("account_id = ?", accountID).Order("created_at DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&records).Error; err != nil {
		return nil, err
	}
	return entriesFromRecords(records)
}

func (s *sqliteLinkStore) Delete(ctx context.Context, accountID, id string) error {
	if strings.TrimSpace(id) == "" {
		return fmt.Errorf("id is required")
	}
	return s.db.WithContext(ctx).Where("account_id = ? AND id = ?", accountID, id).Delete(&linkRecord{}).Error
}

func (s *sqliteLinkStore) Cleanup(ctx context.Context, cutoff time.Time) error {
	return s.db.WithContext(ctx).Where("expires_at <> ? AND expires_at < ?", time.Time{}, cutoff).Delete(&linkRecord{}).Error
}

func recordFromEntry(entry *LinkHistoryEntry) (*linkRecord, error) {
	if entry == nil || entry.ID == "" {
		return nil, fmt.Errorf("invalid history entry")
	}
	record := &linkRecord{
		ID:        entry.ID,
		AccountID: entry.AccountID,
		Bucket:    entry.Bucket,
		Key:       entry.Key,
		Method:    entry.Method,
		URL:       entry.URL,
		FileName:  entry.FileName,
		ExpiresAt: entry.ExpiresAt,
		CreatedAt: entry.CreatedAt,
	}
	if len(entry.ResponseHeaders) > 0 {
		if payload, err := json.Marshal(entry.ResponseHeaders); err == nil {
			record.Headers = payload
		}
	}
	return record, nil
}

func entriesFromRecords(records []linkRecord) ([]LinkHistoryEntry, error) {
	items := make([]LinkHistoryEntry, 0, len(records))
	for i := range records {
		entry := LinkHistoryEntry{
			ID:        records[i].ID,
			AccountID: records[i].AccountID,
			Bucket:    records[i].Bucket,
			Key:       records[i].Key,
			Method:    records[i].Method,
			URL:       records[i].URL,
			FileName:  records[i].FileName,
			ExpiresAt: records[i].ExpiresAt,
			CreatedAt: records[i].CreatedAt,
		}
		if len(records[i].Headers) > 0 {
			var headers map[string]string
			if err := json.Unmarshal(records[i].Headers, &headers); err == nil {
				entry.ResponseHeaders = headers
			}
		}
		items = append(items, entry)
	}
	return items, nil
}
