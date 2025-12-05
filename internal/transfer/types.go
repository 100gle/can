package transfer

import (
	"context"
	"time"
)

// TaskStatus represents the lifecycle state of a transfer task.
type TaskStatus string

const (
	TaskPending   TaskStatus = "pending"
	TaskRunning   TaskStatus = "running"
	TaskPaused    TaskStatus = "paused"
	TaskCompleted TaskStatus = "completed"
	TaskFailed    TaskStatus = "failed"
	TaskCanceled  TaskStatus = "canceled"
)

// TaskType distinguishes uploads from downloads in status views.
type TaskType string

const (
	TaskTypeUpload   TaskType = "upload"
	TaskTypeDownload TaskType = "download"
)

// TransferTask describes the progress of an upload or download.
type TransferTask struct {
	ID             string         `json:"id"`
	Type           TaskType       `json:"type"`
	AccountID      string         `json:"accountId"`
	Bucket         string         `json:"bucket"`
	Key            string         `json:"key"`
	Status         TaskStatus     `json:"status"`
	Progress       int64          `json:"progress"`
	Total          int64          `json:"total"`
	Speed          int64          `json:"speed"`
	EstimatedTime  int64          `json:"estimatedTime"`
	StartTime      time.Time      `json:"startTime"`
	EndTime        *time.Time     `json:"endTime,omitempty"`
	Error          *string        `json:"error,omitempty"`
	Retries        int            `json:"retries"`
	MaxRetries     int            `json:"maxRetries"`
	UploadID       string         `json:"uploadId,omitempty"`
	CompletedParts map[int]string `json:"completedParts,omitempty"`
	cancel         context.CancelFunc
	lastSampleTime time.Time
	lastSnapshot   int64
}

// UploadProgress is sent to the UI for incremental updates.
type UploadProgress struct {
	TaskID   string     `json:"taskId"`
	Progress int64      `json:"progress"`
	Total    int64      `json:"total"`
	Speed    int64      `json:"speed"`
	Status   TaskStatus `json:"status"`
}

func (t *TransferTask) clone() *TransferTask {
	if t == nil {
		return nil
	}
	cp := *t
	if t.CompletedParts != nil {
		cp.CompletedParts = make(map[int]string, len(t.CompletedParts))
		for k, v := range t.CompletedParts {
			cp.CompletedParts[k] = v
		}
	}
	return &cp
}
