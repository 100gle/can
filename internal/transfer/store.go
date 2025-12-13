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
	ListPaged(ctx context.Context, input ListPagedInput) (*ListPagedResult, error)
	CountByStatus(ctx context.Context, statuses ...TaskStatus) (int, error)
	Delete(ctx context.Context, id string) error
}

// ListPagedInput contains pagination parameters for listing tasks.
type ListPagedInput struct {
	Offset   int          // Starting position (0-based)
	Limit    int          // Max items to return
	Statuses []TaskStatus // Optional status filter
}

// ListPagedResult contains paginated task results.
type ListPagedResult struct {
	Tasks []*TransferTask
	Total int64 // Total count for pagination
}

type taskRecord struct {
	ID             string      `gorm:"primaryKey;size:64"`
	Type           TaskType    `gorm:"size:16;index"`
	AccountID      string      `gorm:"size:128;index"`
	Bucket         string      `gorm:"size:512"`
	Key            string      `gorm:"size:2048"`
	LocalPath      string      `gorm:"size:2048"`
	Status         TaskStatus  `gorm:"size:16;index"`
	PauseReason    PauseReason `gorm:"size:32"`
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
	VersionID      string    `gorm:"size:256"`
	ETag           string    `gorm:"size:256"`
	DownloadConfig []byte    `gorm:"type:text"`
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
		PauseReason:    r.PauseReason,
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
		VersionID:      r.VersionID,
		ETag:           r.ETag,
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
	if len(r.DownloadConfig) > 0 {
		var cfg DownloadConfig
		if err := json.Unmarshal(r.DownloadConfig, &cfg); err == nil {
			task.DownloadConfig = &cfg
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
		PauseReason:   task.PauseReason,
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
		VersionID:     task.VersionID,
		ETag:          task.ETag,
		CreatedAt:     task.CreatedAt,
		UpdatedAt:     task.UpdatedAt,
	}
	if len(task.CompletedParts) > 0 {
		if payload, err := json.Marshal(task.CompletedParts); err == nil {
			record.CompletedParts = payload
		}
	}
	if task.DownloadConfig != nil {
		if payload, err := json.Marshal(task.DownloadConfig); err == nil {
			record.DownloadConfig = payload
		}
	}
	return record, nil
}
