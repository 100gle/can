package app

import (
	"path/filepath"
	"strings"

	"can/internal/transfer"
)

// ListTransferTasks returns current transfer queue snapshot.
func (a *App) ListTransferTasks() ([]*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.ListTasks(ctx)
}

// ListTransferTasksInput contains pagination parameters.
type ListTransferTasksInput struct {
	Page     int `json:"page"`     // 1-based page number
	PageSize int `json:"pageSize"` // Items per page, default 20, max 100
}

// ListTransferTasksResult contains paginated task results.
type ListTransferTasksResult struct {
	Tasks      []*transfer.TransferTask `json:"tasks"`
	Total      int64                    `json:"total"`
	Page       int                      `json:"page"`
	PageSize   int                      `json:"pageSize"`
	TotalPages int                      `json:"totalPages"`
}

// ListTransferTasksPaged returns paginated transfer tasks.
func (a *App) ListTransferTasksPaged(input ListTransferTasksInput) (*ListTransferTasksResult, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()

	page := input.Page
	if page < 1 {
		page = 1
	}
	pageSize := input.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	result, err := a.transfers.ListTasksPaged(ctx, page, pageSize)
	if err != nil {
		return nil, err
	}

	totalPages := int(result.Total) / pageSize
	if int(result.Total)%pageSize > 0 {
		totalPages++
	}

	return &ListTransferTasksResult{
		Tasks:      result.Tasks,
		Total:      result.Total,
		Page:       page,
		PageSize:   pageSize,
		TotalPages: totalPages,
	}, nil
}

// CancelTransferTask stops an in-progress transfer.
func (a *App) CancelTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.CancelTask(ctx, taskID)
}

// PauseTransferTask requests the transfer to pause.
func (a *App) PauseTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.PauseTask(ctx, taskID)
}

// ResumeTransferTask marks a paused transfer as running again.
func (a *App) ResumeTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.ResumeTask(ctx, taskID)
}

// SetTransferSpeedLimit sets the global transfer speed limit in bytes per second.
// A value of 0 or negative disables rate limiting.
func (a *App) SetTransferSpeedLimit(bytesPerSec int64) {
	a.transfers.SetGlobalSpeedLimit(bytesPerSec)
}

// GetTransferSpeedLimit returns the current global speed limit in bytes per second.
func (a *App) GetTransferSpeedLimit() int64 {
	return a.transfers.GetGlobalSpeedLimit()
}

// SetTransferConcurrency sets the target number of concurrent transfer workers.
func (a *App) SetTransferConcurrency(count int) {
	a.transfers.SetWorkerCount(count)
}

// GetTransferConfig returns the full transfer service configuration.
func (a *App) GetTransferConfig() transfer.TransferConfig {
	return a.transfers.GetTransferConfig()
}

// DeleteTransferTask removes a specific task from the transfer queue.
// Only completed, failed, or canceled tasks can be deleted.
func (a *App) DeleteTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.DeleteTask(ctx, taskID)
}

// ClearCompletedTransfers removes all completed tasks from the transfer queue.
// Returns the number of tasks cleared.
func (a *App) ClearCompletedTransfers() (int, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.ClearCompletedTasks(ctx)
}

// UploadFilesInput represents the input for batch file upload.
type UploadFilesInput struct {
	AccountID string   `json:"accountId"`
	Bucket    string   `json:"bucket"`
	Prefix    string   `json:"prefix"`
	FilePaths []string `json:"filePaths"`
	BasePath  string   `json:"basePath"` // Common base path to compute relative paths
}

// UploadFilesResult represents the result of batch file upload.
type UploadFilesResult struct {
	Tasks  []*transfer.TransferTask `json:"tasks"`
	Failed []UploadFileError        `json:"failed"`
}

// UploadFileError represents a single file upload error.
type UploadFileError struct {
	FilePath string `json:"filePath"`
	Error    string `json:"error"`
}

// buildUploadObjectKey constructs the object key preserving directory structure.
func buildUploadObjectKey(prefix, relativePath string) string {
	cleanPrefix := strings.TrimPrefix(strings.TrimSuffix(prefix, "/"), "/")
	cleanPath := strings.TrimPrefix(relativePath, "/")
	if cleanPrefix != "" {
		return cleanPrefix + "/" + cleanPath
	}
	return cleanPath
}

// UploadFilesFromPaths enqueues multiple local files for upload to the transfer queue.
// This bypasses the frontend's local upload logic and uses the backend transfer service
// for proper progress tracking, speed limiting, and persistence.
func (a *App) UploadFilesFromPaths(input UploadFilesInput) UploadFilesResult {
	ctx, cancel := a.backgroundContext()
	defer cancel()

	result := UploadFilesResult{
		Tasks:  make([]*transfer.TransferTask, 0, len(input.FilePaths)),
		Failed: make([]UploadFileError, 0),
	}

	for _, filePath := range input.FilePaths {
		// Compute relative path from base to preserve directory structure
		var relativePath string
		if input.BasePath != "" {
			rel, err := filepath.Rel(input.BasePath, filePath)
			if err != nil {
				relativePath = filepath.Base(filePath)
			} else {
				relativePath = filepath.ToSlash(rel)
			}
		} else {
			relativePath = filepath.Base(filePath)
		}

		// Build object key preserving directory structure
		key := buildUploadObjectKey(input.Prefix, relativePath)

		task, err := a.objects.UploadObject(ctx, input.AccountID, input.Bucket, key, filePath)
		if err != nil {
			result.Failed = append(result.Failed, UploadFileError{
				FilePath: filePath,
				Error:    err.Error(),
			})
			continue
		}
		result.Tasks = append(result.Tasks, task)
	}

	return result
}
