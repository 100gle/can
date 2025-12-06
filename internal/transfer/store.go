package transfer

import (
	"context"
	"encoding/json"
	"errors"
	"time"
)

// Store persists transfer tasks so they survive restarts.
type Store interface {
	Create(ctx context.Context, task *TransferTask) error
	Update(ctx context.Context, task *TransferTask) error
	Get(ctx context.Context, id string) (*TransferTask, error)
	List(ctx context.Context) ([]*TransferTask, error)
	ListByStatus(ctx context.Context, statuses ...TaskStatus) ([]*TransferTask, error)
	CountByStatus(ctx context.Context, statuses ...TaskStatus) (int, error)
}

type taskRecord struct {
	ID             string     `gorm:"primaryKey;size:64"`
	Type           TaskType   `gorm:"size:16;index"`
	AccountID      string     `gorm:"size:128;index"`
	Bucket         string     `gorm:"size:512"`
	Key            string     `gorm:"size:2048"`
	LocalPath      string     `gorm:"size:2048"`
	Status         TaskStatus `gorm:"size:16;index"`
	Progress       int64
	Total          int64
	Speed          int64
	EstimatedTime  int64
	StartTime      time.Time
	EndTime        *time.Time
	Error          *string `gorm:"type:text"`
	Retries        int
	MaxRetries     int
	UploadID       string    `gorm:"size:256"`
	CompletedParts []byte    `gorm:"type:text"`
	CreatedAt      time.Time `gorm:"autoCreateTime"`
	UpdatedAt      time.Time `gorm:"autoUpdateTime"`
}

func (r *taskRecord) toTask() (*TransferTask, error) {
	if r == nil {
		return nil, errors.New("nil task record")
	}
	task := &TransferTask{
		ID:             r.ID,
		Type:           r.Type,
		AccountID:      r.AccountID,
		Bucket:         r.Bucket,
		Key:            r.Key,
		LocalPath:      r.LocalPath,
		Status:         r.Status,
		Progress:       r.Progress,
		Total:          r.Total,
		Speed:          r.Speed,
		EstimatedTime:  r.EstimatedTime,
		StartTime:      r.StartTime,
		EndTime:        r.EndTime,
		Error:          r.Error,
		Retries:        r.Retries,
		MaxRetries:     r.MaxRetries,
		UploadID:       r.UploadID,
		CreatedAt:      r.CreatedAt,
		UpdatedAt:      r.UpdatedAt,
		lastSampleTime: time.Now(),
		lastSnapshot:   r.Progress,
		lastPersisted:  time.Now(),
	}
	if len(r.CompletedParts) > 0 {
		var parts map[int]string
		if err := json.Unmarshal(r.CompletedParts, &parts); err == nil {
			task.CompletedParts = parts
		}
	}
	return task, nil
}

func recordFromTask(task *TransferTask) (*taskRecord, error) {
	if task == nil {
		return nil, errors.New("nil transfer task")
	}
	record := &taskRecord{
		ID:            task.ID,
		Type:          task.Type,
		AccountID:     task.AccountID,
		Bucket:        task.Bucket,
		Key:           task.Key,
		LocalPath:     task.LocalPath,
		Status:        task.Status,
		Progress:      task.Progress,
		Total:         task.Total,
		Speed:         task.Speed,
		EstimatedTime: task.EstimatedTime,
		StartTime:     task.StartTime,
		EndTime:       task.EndTime,
		Error:         task.Error,
		Retries:       task.Retries,
		MaxRetries:    task.MaxRetries,
		UploadID:      task.UploadID,
		CreatedAt:     task.CreatedAt,
		UpdatedAt:     task.UpdatedAt,
	}
	if len(task.CompletedParts) > 0 {
		if payload, err := json.Marshal(task.CompletedParts); err == nil {
			record.CompletedParts = payload
		}
	}
	return record, nil
}
