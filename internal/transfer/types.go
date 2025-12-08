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

// Priority defines the urgency of a transfer task.
type Priority int

const (
	PriorityLow      Priority = 0
	PriorityNormal   Priority = 1
	PriorityHigh     Priority = 2
	PriorityCritical Priority = 3
)

// PauseReason captures why a task was paused.
type PauseReason string

const (
	PauseReasonUnknown PauseReason = ""
	PauseReasonUser    PauseReason = "user"
	PauseReasonNetwork PauseReason = "network"
)

// DownloadMode distinguishes between single-object and archive tasks.
type DownloadMode string

const (
	DownloadModeSingle  DownloadMode = "single"
	DownloadModeArchive DownloadMode = "archive"
)

// FileConflictStrategy defines how to handle local name collisions.
type FileConflictStrategy string

const (
	ConflictStrategyOverwrite FileConflictStrategy = "overwrite"
	ConflictStrategyRename    FileConflictStrategy = "rename"
)

// DownloadEntry describes a single object that will be bundled into an archive download.
type DownloadEntry struct {
	Bucket       string `json:"bucket"`
	Key          string `json:"key"`
	RelativePath string `json:"relativePath"`
	Size         int64  `json:"size"`
	VersionID    string `json:"versionId"`
	IsDir        bool   `json:"isDir"`
}

// DownloadConfig captures user preferences for downloads.
type DownloadConfig struct {
	Mode              DownloadMode         `json:"mode"`
	TargetDirectory   string               `json:"targetDirectory"`
	ArchiveName       string               `json:"archiveName"`
	ConflictStrategy  FileConflictStrategy `json:"conflictStrategy"`
	Entries           []DownloadEntry      `json:"entries"`
	ResumeEnabled     bool                 `json:"resumeEnabled"`
	ChecksumAlgorithm ChecksumAlgorithm    `json:"checksumAlgorithm,omitempty"`
	ExpectedChecksum  string               `json:"expectedChecksum,omitempty"`
}

// TransferTask describes the progress of an upload or download.
type TransferTask struct {
	ID             string          `json:"id"`
	Type           TaskType        `json:"type"`
	Priority       Priority        `json:"priority"`
	AccountID      string          `json:"accountId"`
	Bucket         string          `json:"bucket"`
	Key            string          `json:"key"`
	LocalPath      string          `json:"localPath,omitempty"`
	Status         TaskStatus      `json:"status"`
	PauseReason    PauseReason     `json:"pauseReason,omitempty"`
	Progress       int64           `json:"progress"`
	Total          int64           `json:"total"`
	Speed          int64           `json:"speed"`
	EstimatedTime  int64           `json:"estimatedTime"`
	StartTime      time.Time       `json:"startTime" ts_type:"string"`
	EndTime        *time.Time      `json:"endTime,omitempty" ts_type:"string"`
	Error          *string         `json:"error,omitempty"`
	Retries        int             `json:"retries"`
	MaxRetries     int             `json:"maxRetries"`
	UploadID       string          `json:"uploadId,omitempty"`
	CompletedParts map[int]string  `json:"completedParts,omitempty"`
	VersionID      string          `json:"versionId,omitempty"`
	ETag           string          `json:"etag,omitempty"`
	DownloadConfig *DownloadConfig `json:"downloadConfig,omitempty"`
	CreatedAt      time.Time       `json:"createdAt" ts_type:"string"`
	UpdatedAt      time.Time       `json:"updatedAt" ts_type:"string"`
	// Checksum verification fields
	ComputedChecksum string `json:"computedChecksum,omitempty"`
	ChecksumVerified *bool  `json:"checksumVerified,omitempty"`
	// Enhanced metadata fields
	FinalSavePath  string `json:"finalSavePath,omitempty"`
	AverageSpeed   int64  `json:"averageSpeed,omitempty"`
	Duration       int64  `json:"duration,omitempty"` // milliseconds
	cancel         context.CancelFunc
	lastSampleTime time.Time
	lastSnapshot   int64
	lastPersisted  time.Time
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
	if t.DownloadConfig != nil {
		cfg := *t.DownloadConfig
		if len(t.DownloadConfig.Entries) > 0 {
			cfg.Entries = make([]DownloadEntry, len(t.DownloadConfig.Entries))
			copy(cfg.Entries, t.DownloadConfig.Entries)
		}
		cp.DownloadConfig = &cfg
	}
	cp.cancel = nil
	return &cp
}
