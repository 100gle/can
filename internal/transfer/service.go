package transfer

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"

	"can/internal/accounts"
	"can/internal/providers"
)

// ErrTaskNotFound indicates the requested task does not exist.
var ErrTaskNotFound = errors.New("transfer task not found")

// Service tracks upload/download tasks in memory for UI polling.
type Service struct {
	accounts    *accounts.Service
	factory     providers.StorageFactory
	uploadMgr   *UploadManager
	downloadMgr *DownloadManager
}

// NewService wires the dependencies required by the transfer subsystem.
func NewService(accounts *accounts.Service, factory providers.StorageFactory) *Service {
	return &Service{
		accounts:    accounts,
		factory:     factory,
		uploadMgr:   NewUploadManager(),
		downloadMgr: NewDownloadManager(),
	}
}

// CreateUploadTask registers a new upload task before execution begins.
func (s *Service) CreateUploadTask(accountID, bucket, key string, total int64) *TransferTask {
	task := &TransferTask{
		ID:             uuid.NewString(),
		Type:           TaskTypeUpload,
		AccountID:      strings.TrimSpace(accountID),
		Bucket:         strings.TrimSpace(bucket),
		Key:            strings.TrimSpace(key),
		Status:         TaskPending,
		Total:          total,
		MaxRetries:     3,
		StartTime:      time.Now(),
		EstimatedTime:  -1,
		lastSampleTime: time.Now(),
		lastSnapshot:   0,
	}
	s.uploadMgr.Add(task)
	return task
}

// CreateDownloadTask registers a new download task.
func (s *Service) CreateDownloadTask(accountID, bucket, key string, total int64) *TransferTask {
	task := &TransferTask{
		ID:             uuid.NewString(),
		Type:           TaskTypeDownload,
		AccountID:      strings.TrimSpace(accountID),
		Bucket:         strings.TrimSpace(bucket),
		Key:            strings.TrimSpace(key),
		Status:         TaskPending,
		Total:          total,
		MaxRetries:     3,
		StartTime:      time.Now(),
		EstimatedTime:  -1,
		lastSampleTime: time.Now(),
		lastSnapshot:   0,
	}
	s.downloadMgr.Add(task)
	return task
}

// GetOrCreateTask returns an existing task or creates a placeholder entry.
func (s *Service) GetOrCreateTask(_ context.Context, id string) (*TransferTask, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("task id is required")
	}
	if task := s.lookupTask(id); task != nil {
		return task.clone(), nil
	}
	task := &TransferTask{
		ID:             id,
		Type:           TaskTypeUpload,
		Status:         TaskPending,
		StartTime:      time.Now(),
		EstimatedTime:  -1,
		lastSampleTime: time.Now(),
	}
	s.uploadMgr.Add(task)
	return task.clone(), nil
}

// ListTasks returns all transfers sorted by start time (desc).
func (s *Service) ListTasks(_ context.Context) ([]*TransferTask, error) {
	uploads := s.uploadMgr.List()
	downloads := s.downloadMgr.List()
	tasks := make([]*TransferTask, 0, len(uploads)+len(downloads))
	for _, task := range uploads {
		tasks = append(tasks, task.clone())
	}
	for _, task := range downloads {
		tasks = append(tasks, task.clone())
	}
	sort.Slice(tasks, func(i, j int) bool {
		return tasks[i].StartTime.After(tasks[j].StartTime)
	})
	return tasks, nil
}

// GetTaskProgress returns a snapshot of the requested task.
func (s *Service) GetTaskProgress(_ context.Context, taskID string) (*TransferTask, error) {
	if strings.TrimSpace(taskID) == "" {
		return nil, errors.New("task id is required")
	}
	task := s.lookupTask(taskID)
	if task == nil {
		return nil, ErrTaskNotFound
	}
	return task.clone(), nil
}

// CancelTask stops a running transfer if possible.
func (s *Service) CancelTask(_ context.Context, taskID string) error {
	task, err := s.withTask(taskID, func(task *TransferTask) {
		task.Status = TaskCanceled
		now := time.Now()
		task.EndTime = &now
	})
	if err != nil {
		return err
	}
	if task.cancel != nil {
		task.cancel()
	}
	return nil
}

// PauseTask attempts to pause an active transfer.
func (s *Service) PauseTask(_ context.Context, taskID string) error {
	task, err := s.withTask(taskID, func(task *TransferTask) {
		if task.Status == TaskCompleted || task.Status == TaskFailed || task.Status == TaskCanceled {
			return
		}
		task.Status = TaskPaused
	})
	if err != nil {
		return err
	}
	if task.cancel != nil {
		task.cancel()
	}
	return nil
}

// ResumeTask marks a paused task as running so UI can re-queue work.
func (s *Service) ResumeTask(_ context.Context, taskID string) error {
	_, err := s.withTask(taskID, func(task *TransferTask) {
		if task.Status != TaskPaused {
			return
		}
		task.Status = TaskRunning
		task.lastSampleTime = time.Now()
		task.lastSnapshot = task.Progress
	})
	return err
}

// BindTaskContext stores the cancel function so future cancel/pause calls can propagate.
func (s *Service) BindTaskContext(taskID string, cancel context.CancelFunc) {
	if cancel == nil {
		return
	}
	_, _ = s.withTask(taskID, func(task *TransferTask) {
		task.cancel = cancel
	})
}

// MarkTaskRunning switches the task into the running state.
func (s *Service) MarkTaskRunning(taskID string) {
	_, _ = s.withTask(taskID, func(task *TransferTask) {
		task.Status = TaskRunning
		if task.StartTime.IsZero() {
			task.StartTime = time.Now()
		}
		task.lastSampleTime = time.Now()
		task.lastSnapshot = task.Progress
	})
}

// UpdateTaskProgress increments the transferred bytes and recalculates ETA.
func (s *Service) UpdateTaskProgress(taskID string, delta int64) {
	if delta <= 0 {
		return
	}
	_, _ = s.withTask(taskID, func(task *TransferTask) {
		task.Progress += delta
		now := time.Now()
		if task.lastSampleTime.IsZero() {
			task.lastSampleTime = now
			task.lastSnapshot = task.Progress
			return
		}
		elapsed := now.Sub(task.lastSampleTime)
		if elapsed < 200*time.Millisecond {
			return
		}
		bytesSince := task.Progress - task.lastSnapshot
		if bytesSince < 0 {
			bytesSince = 0
		}
		if elapsed > 0 {
			task.Speed = int64(float64(bytesSince) / elapsed.Seconds())
		}
		task.lastSampleTime = now
		task.lastSnapshot = task.Progress
		remaining := task.Total - task.Progress
		if remaining <= 0 {
			task.EstimatedTime = 0
		} else if task.Speed > 0 {
			task.EstimatedTime = int64(float64(remaining)/float64(task.Speed) + 0.5)
		} else {
			task.EstimatedTime = -1
		}
	})
}

// CompleteTask marks a task as finished successfully.
func (s *Service) CompleteTask(taskID string) {
	now := time.Now()
	_, _ = s.withTask(taskID, func(task *TransferTask) {
		task.Status = TaskCompleted
		task.EndTime = &now
		task.Speed = 0
		task.EstimatedTime = 0
		task.Error = nil
	})
}

// FailTask records a failure message for the task.
func (s *Service) FailTask(taskID string, failure error) {
	now := time.Now()
	message := "transfer failed"
	if failure != nil {
		message = failure.Error()
	}
	_, _ = s.withTask(taskID, func(task *TransferTask) {
		task.Status = TaskFailed
		task.EndTime = &now
		task.Speed = 0
		task.EstimatedTime = -1
		task.Error = &message
	})
}

// SetUploadMetadata stores multipart details so the UI can resume later.
func (s *Service) SetUploadMetadata(taskID, uploadID string, completed map[int]string) {
	_, _ = s.withTask(taskID, func(task *TransferTask) {
		task.UploadID = strings.TrimSpace(uploadID)
		if len(completed) == 0 {
			return
		}
		if task.CompletedParts == nil {
			task.CompletedParts = make(map[int]string, len(completed))
		}
		for k, v := range completed {
			task.CompletedParts[k] = v
		}
	})
}

// SetTaskTotal updates the total bytes to transfer once known.
func (s *Service) SetTaskTotal(taskID string, total int64) {
	if total <= 0 {
		return
	}
	_, _ = s.withTask(taskID, func(task *TransferTask) {
		task.Total = total
	})
}

func (s *Service) lookupTask(id string) *TransferTask {
	if task, ok := s.uploadMgr.Get(id); ok {
		return task
	}
	if task, ok := s.downloadMgr.Get(id); ok {
		return task
	}
	return nil
}

func (s *Service) withTask(id string, fn func(task *TransferTask)) (*TransferTask, error) {
	if task, ok := s.uploadMgr.Update(id, fn); ok {
		return task, nil
	}
	if task, ok := s.downloadMgr.Update(id, fn); ok {
		return task, nil
	}
	return nil, ErrTaskNotFound
}
