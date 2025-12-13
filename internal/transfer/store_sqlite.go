package transfer

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// sqliteStore persists transfer tasks using SQLite via GORM.
type sqliteStore struct {
	db *gorm.DB
}

// NewSQLiteStore creates a new store using the provided GORM database connection.
func NewSQLiteStore(db *gorm.DB) (Store, error) {
	if db == nil {
		return nil, fmt.Errorf("db is required")
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

func (s *sqliteStore) ListPaged(ctx context.Context, input ListPagedInput) (*ListPagedResult, error) {
	var records []taskRecord
	var total int64

	// Build base query with optional status filter
	baseQuery := s.db.WithContext(ctx).Model(&taskRecord{})
	if len(input.Statuses) > 0 {
		baseQuery = baseQuery.Where("status IN ?", input.Statuses)
	}

	// Get total count first
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, err
	}

	// Get paged results
	query := s.db.WithContext(ctx).Order("start_time DESC")
	if len(input.Statuses) > 0 {
		query = query.Where("status IN ?", input.Statuses)
	}
	if input.Offset > 0 {
		query = query.Offset(input.Offset)
	}
	if input.Limit > 0 {
		query = query.Limit(input.Limit)
	}
	if err := query.Find(&records).Error; err != nil {
		return nil, err
	}

	tasks, err := mapRecords(records)
	if err != nil {
		return nil, err
	}

	return &ListPagedResult{
		Tasks: tasks,
		Total: total,
	}, nil
}

func (s *sqliteStore) CountByStatus(ctx context.Context, statuses ...TaskStatus) (int, error) {
	var count int64
	query := s.db.WithContext(ctx).Model(&taskRecord{})
	if len(statuses) > 0 {
		query = query.Where("status IN ?", statuses)
	}
	if err := query.Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count), nil
}

func (s *sqliteStore) Delete(ctx context.Context, id string) error {
	result := s.db.WithContext(ctx).Delete(&taskRecord{}, "id = ?", id)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrTaskNotFound
	}
	return nil
}
