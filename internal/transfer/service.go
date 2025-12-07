package transfer

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"can/internal/accounts"
	"can/internal/providers"
)

const (
	defaultWorkerCount      = 2
	defaultQueueSize        = 32
	progressFlushInterval   = 500 * time.Millisecond
	progressSampleThreshold = 200 * time.Millisecond
)

// ErrTaskNotFound indicates the requested task does not exist.
var ErrTaskNotFound = errors.New("transfer task not found")

// UploadRequest describes the metadata required to enqueue an upload task.
type UploadRequest struct {
	AccountID string
	Bucket    string
	Key       string
	FilePath  string
	Priority  Priority
}

// DownloadRequest describes the metadata required to enqueue a download task.
type DownloadRequest struct {
	AccountID        string
	Bucket           string
	Key              string
	SavePath         string
	TargetDirectory  string
	Priority         Priority
	Mode             DownloadMode
	Entries          []DownloadEntry
	ArchiveName      string
	ConflictStrategy FileConflictStrategy
	DisableResume    bool
	VersionID        string
	ExpectedETag     string
}

// Option mutates the transfer service configuration.
type Option func(cfg *serviceConfig)

type serviceConfig struct {
	workers   int
	queueSize int
}

// WithWorkerCount overrides the default number of worker goroutines.
func WithWorkerCount(workers int) Option {
	return func(cfg *serviceConfig) {
		cfg.workers = workers
	}
}

// WithQueueSize overrides the default internal queue capacity.
func WithQueueSize(size int) Option {
	return func(cfg *serviceConfig) {
		cfg.queueSize = size
	}
}

// Service coordinates transfer tasks, persists them, and executes work asynchronously.
type Service struct {
	accounts *accounts.Service
	pool     providers.ClientPool
	store    Store

	queue   *taskQueue
	workers int

	mu            sync.RWMutex
	runtimes      map[string]*taskRuntime
	globalLimiter *RateLimiter
}

type taskRuntime struct {
	cancel context.CancelFunc
	mu     sync.Mutex
	reason stopReason
}

type stopReason uint8

const (
	stopReasonNone stopReason = iota
	stopReasonPause
	stopReasonCancel
)

func (r *taskRuntime) setReason(reason stopReason) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if reason != stopReasonNone {
		r.reason = reason
	}
}

func (r *taskRuntime) getReason() stopReason {
	if r == nil {
		return stopReasonNone
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.reason
}

// NewService wires the dependencies required by the transfer subsystem.
func NewService(accounts *accounts.Service, pool providers.ClientPool, store Store, opts ...Option) *Service {
	if store == nil {
		store = NewMemoryStore()
	}
	cfg := &serviceConfig{
		workers:   defaultWorkerCount,
		queueSize: defaultQueueSize,
	}
	for _, opt := range opts {
		if opt != nil {
			opt(cfg)
		}
	}
	if cfg.workers <= 0 {
		cfg.workers = defaultWorkerCount
	}
	if cfg.queueSize <= 0 {
		cfg.queueSize = defaultQueueSize
	}
	svc := &Service{
		accounts:      accounts,
		pool:          pool,
		store:         store,
		queue:         newTaskQueue(cfg.queueSize),
		workers:       cfg.workers,
		runtimes:      make(map[string]*taskRuntime),
		globalLimiter: NewRateLimiter(0), // 0 means no limit
	}
	svc.restorePendingTasks()
	svc.startWorkers()
	return svc
}

// EnqueueUpload creates a transfer task for uploading the provided file.
func (s *Service) EnqueueUpload(ctx context.Context, req UploadRequest) (*TransferTask, error) {
	req.AccountID = strings.TrimSpace(req.AccountID)
	req.Bucket = strings.TrimSpace(req.Bucket)
	req.Key = strings.TrimSpace(req.Key)
	req.FilePath = strings.TrimSpace(req.FilePath)
	if req.AccountID == "" {
		return nil, errors.New("account id is required")
	}
	if req.Bucket == "" {
		return nil, errors.New("bucket is required")
	}
	if req.Key == "" {
		return nil, errors.New("object key is required")
	}
	if req.FilePath == "" {
		return nil, errors.New("file path is required")
	}
	info, err := os.Stat(req.FilePath)
	if err != nil {
		return nil, fmt.Errorf("stat source file: %w", err)
	}
	task := &TransferTask{
		ID:             uuid.NewString(),
		Type:           TaskTypeUpload,
		AccountID:      req.AccountID,
		Bucket:         req.Bucket,
		Key:            req.Key,
		LocalPath:      req.FilePath,
		Priority:       req.Priority,
		Status:         TaskPending,
		Total:          info.Size(),
		EstimatedTime:  -1,
		StartTime:      time.Now(),
		MaxRetries:     3,
		lastSampleTime: time.Now(),
		lastSnapshot:   0,
	}
	if err := s.store.Create(ctx, task); err != nil {
		return nil, err
	}
	s.enqueue(task.ID, task.Priority)
	return task.clone(), nil
}

// EnqueueDownload creates a transfer task for downloading a remote object.
func (s *Service) EnqueueDownload(ctx context.Context, req DownloadRequest) (*TransferTask, error) {
	req.AccountID = strings.TrimSpace(req.AccountID)
	req.Bucket = strings.TrimSpace(req.Bucket)
	req.Key = strings.TrimSpace(req.Key)
	req.SavePath = strings.TrimSpace(req.SavePath)
	req.TargetDirectory = strings.TrimSpace(req.TargetDirectory)
	if req.AccountID == "" {
		return nil, errors.New("account id is required")
	}
	mode := req.Mode
	if mode == "" {
		if len(req.Entries) > 0 {
			mode = DownloadModeArchive
		} else {
			mode = DownloadModeSingle
		}
	}
	cfg := &DownloadConfig{
		Mode:             mode,
		TargetDirectory:  req.TargetDirectory,
		ConflictStrategy: normalizeConflictStrategy(req.ConflictStrategy),
	}
	if cfg.TargetDirectory != "" {
		cfg.TargetDirectory = filepath.Clean(cfg.TargetDirectory)
	}
	var (
		bucket  = req.Bucket
		key     = req.Key
		local   = req.SavePath
		total   int64
		entries []DownloadEntry
	)
	switch mode {
	case DownloadModeArchive:
		var err error
		entries, err = s.prepareArchiveEntries(req)
		if err != nil {
			return nil, err
		}
		cfg.Entries = entries
		cfg.ResumeEnabled = false
		cfg.ArchiveName = ensureArchiveName(req.ArchiveName, entries)
		if bucket == "" && len(entries) > 0 {
			bucket = entries[0].Bucket
		}
		key = cfg.ArchiveName
		if local == "" {
			baseDir := cfg.TargetDirectory
			if baseDir == "" {
				baseDir = defaultDownloadDir()
			}
			local = filepath.Join(baseDir, cfg.ArchiveName)
		}
		total = sumEntrySizes(entries)
	case DownloadModeSingle:
		if bucket == "" {
			return nil, errors.New("bucket is required")
		}
		if key == "" {
			return nil, errors.New("object key is required")
		}
		cfg.ResumeEnabled = !req.DisableResume
		if local == "" {
			baseDir := cfg.TargetDirectory
			if baseDir == "" {
				baseDir = defaultDownloadDir()
			}
			local = filepath.Join(baseDir, filepath.Base(key))
		}
	default:
		return nil, fmt.Errorf("unsupported download mode %s", mode)
	}
	task := &TransferTask{
		ID:             uuid.NewString(),
		Type:           TaskTypeDownload,
		AccountID:      req.AccountID,
		Bucket:         bucket,
		Key:            key,
		LocalPath:      local,
		Priority:       req.Priority,
		Status:         TaskPending,
		EstimatedTime:  -1,
		StartTime:      time.Now(),
		MaxRetries:     3,
		DownloadConfig: cfg,
		VersionID:      strings.TrimSpace(req.VersionID),
		ETag:           strings.TrimSpace(req.ExpectedETag),
		Total:          total,
		lastSampleTime: time.Now(),
		lastSnapshot:   0,
	}
	if err := s.store.Create(ctx, task); err != nil {
		return nil, err
	}
	s.enqueue(task.ID, task.Priority)
	return task.clone(), nil
}

func (s *Service) prepareArchiveEntries(req DownloadRequest) ([]DownloadEntry, error) {
	if len(req.Entries) == 0 {
		return nil, errors.New("download entries are required")
	}
	entries := make([]DownloadEntry, 0, len(req.Entries))
	for _, entry := range req.Entries {
		bucket := strings.TrimSpace(entry.Bucket)
		if bucket == "" {
			bucket = req.Bucket
		}
		if bucket == "" {
			return nil, errors.New("entry bucket is required")
		}
		key := strings.TrimSpace(entry.Key)
		if key == "" && !entry.IsDir {
			return nil, errors.New("entry key is required")
		}
		rel := entry.RelativePath
		if strings.TrimSpace(rel) == "" {
			rel = key
		}
		entries = append(entries, DownloadEntry{
			Bucket:       bucket,
			Key:          key,
			RelativePath: sanitizeRelativePath(rel, entry.IsDir, key),
			Size:         entry.Size,
			VersionID:    strings.TrimSpace(entry.VersionID),
			IsDir:        entry.IsDir,
		})
	}
	return entries, nil
}

func normalizeConflictStrategy(strategy FileConflictStrategy) FileConflictStrategy {
	switch strings.ToLower(string(strategy)) {
	case string(ConflictStrategyRename):
		return ConflictStrategyRename
	default:
		return ConflictStrategyOverwrite
	}
}

func ensureArchiveName(name string, entries []DownloadEntry) string {
	trimmed := filepath.Base(strings.TrimSpace(name))
	if trimmed == "" {
		if len(entries) == 1 {
			candidate := filepath.Base(entries[0].RelativePath)
			if candidate != "" {
				trimmed = candidate
			}
		}
	}
	if trimmed == "" {
		trimmed = fmt.Sprintf("download-%s.zip", time.Now().Format("20060102150405"))
	}
	if !strings.HasSuffix(strings.ToLower(trimmed), ".zip") {
		trimmed += ".zip"
	}
	return filepath.Base(trimmed)
}

func defaultDownloadDir() string {
	if dir := strings.TrimSpace(os.TempDir()); dir != "" {
		return dir
	}
	return "."
}

func sumEntrySizes(entries []DownloadEntry) int64 {
	var total int64
	for _, entry := range entries {
		if entry.IsDir || entry.Size <= 0 {
			continue
		}
		total += entry.Size
	}
	return total
}

func sanitizeRelativePath(name string, isDir bool, fallback string) string {
	value := strings.TrimSpace(name)
	if value == "" {
		value = strings.TrimSpace(fallback)
	}
	value = filepath.Clean(value)
	value = filepath.ToSlash(value)
	value = strings.TrimPrefix(value, "./")
	for strings.HasPrefix(value, "../") {
		value = strings.TrimPrefix(value, "../")
	}
	value = strings.TrimLeft(value, "/")
	if value == "" {
		value = "object"
	}
	if isDir && !strings.HasSuffix(value, "/") {
		value += "/"
	}
	return value
}

// ListTasks returns all transfers sorted by start time (desc).
func (s *Service) ListTasks(ctx context.Context) ([]*TransferTask, error) {
	records, err := s.store.List(ctx)
	if err != nil {
		return nil, err
	}
	tasks := make([]*TransferTask, len(records))
	for i, task := range records {
		tasks[i] = task.clone()
	}
	return tasks, nil
}

// CountActiveTasks returns the number of currently running or pending tasks.
func (s *Service) CountActiveTasks(ctx context.Context) (int, error) {
	return s.store.CountByStatus(ctx, TaskRunning, TaskPending)
}

// GetTaskProgress returns a snapshot of the requested task.
func (s *Service) GetTaskProgress(ctx context.Context, taskID string) (*TransferTask, error) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, errors.New("task id is required")
	}
	task, err := s.store.Get(ctx, taskID)
	if err != nil {
		return nil, err
	}
	return task.clone(), nil
}

// CancelTask stops a running transfer if possible.
func (s *Service) CancelTask(ctx context.Context, taskID string) error {
	task, err := s.store.Get(ctx, strings.TrimSpace(taskID))
	if err != nil {
		return err
	}
	switch task.Status {
	case TaskCompleted, TaskFailed, TaskCanceled:
		return nil
	}
	now := time.Now()
	task.Status = TaskCanceled
	task.EndTime = &now
	task.Speed = 0
	task.EstimatedTime = -1
	task.Error = nil
	if err := s.store.Update(ctx, task); err != nil {
		return err
	}
	s.requestStop(task.ID, stopReasonCancel)
	return nil
}

// PauseTask attempts to pause an active transfer.
func (s *Service) PauseTask(ctx context.Context, taskID string) error {
	task, err := s.store.Get(ctx, strings.TrimSpace(taskID))
	if err != nil {
		return err
	}
	switch task.Status {
	case TaskCompleted, TaskFailed, TaskCanceled, TaskPaused:
		return nil
	}
	task.Status = TaskPaused
	task.Speed = 0
	task.EstimatedTime = -1
	if err := s.store.Update(ctx, task); err != nil {
		return err
	}
	s.requestStop(task.ID, stopReasonPause)
	return nil
}

// ResumeTask marks a paused task as running again.
func (s *Service) ResumeTask(ctx context.Context, taskID string) error {
	task, err := s.store.Get(ctx, strings.TrimSpace(taskID))
	if err != nil {
		return err
	}
	if task.Status != TaskPaused {
		return nil
	}
	task.Status = TaskPending
	task.EndTime = nil
	task.Error = nil
	if err := s.store.Update(ctx, task); err != nil {
		return err
	}
	s.enqueue(task.ID, task.Priority)
	return nil
}

// SetGlobalSpeedLimit sets the global transfer speed limit in bytes per second.
// A value of 0 or negative disables rate limiting.
func (s *Service) SetGlobalSpeedLimit(bytesPerSec int64) {
	if s.globalLimiter != nil {
		s.globalLimiter.SetLimit(bytesPerSec)
	}
}

// GetGlobalSpeedLimit returns the current global speed limit in bytes per second.
func (s *Service) GetGlobalSpeedLimit() int64 {
	if s.globalLimiter != nil {
		return s.globalLimiter.Limit()
	}
	return 0
}

// Close gracefully shuts down the transfer service.
// It closes the task queue which causes workers to exit after finishing their current task.
func (s *Service) Close() {
	if s.queue != nil {
		s.queue.Close()
	}
}

func (s *Service) startWorkers() {
	for i := 0; i < s.workers; i++ {
		go s.worker()
	}
}

func (s *Service) worker() {
	for {
		taskID, ok := s.queue.Pop()
		if !ok {
			return
		}
		if err := s.runTask(taskID); err != nil && !errors.Is(err, ErrTaskNotFound) {
			fmt.Printf("transfer task %s failed: %v\n", taskID, err)
		}
	}
}

func (s *Service) runTask(taskID string) error {
	task, err := s.store.Get(context.Background(), taskID)
	if err != nil {
		return err
	}
	if task.Status != TaskPending && task.Status != TaskRunning {
		return nil
	}
	task.Status = TaskRunning
	if task.StartTime.IsZero() {
		task.StartTime = time.Now()
	}
	task.lastSampleTime = time.Now()
	task.lastSnapshot = task.Progress
	task.EstimatedTime = -1
	task.Error = nil
	if err := s.store.Update(context.Background(), task); err != nil {
		return err
	}
	ctx, cancel := context.WithCancel(context.Background())
	runtime := s.registerRuntime(task.ID, cancel)
	defer s.unregisterRuntime(task.ID)
	err = s.executeTask(ctx, task)
	switch {
	case err == nil:
		now := time.Now()
		task.Status = TaskCompleted
		task.EndTime = &now
		task.Speed = 0
		task.EstimatedTime = 0
		task.Error = nil
	case errors.Is(err, context.Canceled) && runtime.getReason() == stopReasonPause:
		task.Status = TaskPaused
		task.Speed = 0
		task.EstimatedTime = -1
	case errors.Is(err, context.Canceled) && runtime.getReason() == stopReasonCancel:
		now := time.Now()
		task.Status = TaskCanceled
		task.EndTime = &now
		task.Speed = 0
		task.EstimatedTime = -1
	default:
		// Check if we can retry
		if task.Retries < task.MaxRetries {
			task.Retries++
			backoff := s.computeBackoff(task.Retries)
			message := fmt.Sprintf("attempt %d failed: %v, retrying in %v", task.Retries, err, backoff)
			task.Error = &message
			task.Status = TaskPending
			task.Speed = 0
			task.EstimatedTime = -1
			if err := s.store.Update(context.Background(), task); err != nil {
				return err
			}
			// Schedule re-queue after backoff without blocking the worker
			time.AfterFunc(backoff, func() {
				s.enqueue(task.ID, task.Priority)
			})
			return nil
		}
		// Max retries exceeded, mark as failed
		now := time.Now()
		task.Status = TaskFailed
		task.EndTime = &now
		message := err.Error()
		task.Error = &message
		task.Speed = 0
		task.EstimatedTime = -1
	}
	return s.store.Update(context.Background(), task)
}

func (s *Service) executeTask(ctx context.Context, task *TransferTask) error {
	switch task.Type {
	case TaskTypeUpload:
		return s.executeUpload(ctx, task)
	case TaskTypeDownload:
		return s.executeDownload(ctx, task)
	default:
		return fmt.Errorf("unsupported task type %s", task.Type)
	}
}

func (s *Service) executeSingleDownload(ctx context.Context, task *TransferTask) error {
	startTime := time.Now()
	client, err := s.client(ctx, task.AccountID)
	if err != nil {
		return err
	}
	target, err := s.resolveDownloadPath(task)
	if err != nil {
		return err
	}
	cfg := task.DownloadConfig
	resume := true
	if cfg != nil {
		resume = cfg.ResumeEnabled
	}
	offset, err := s.prepareResumeOffset(task, target, resume)
	if err != nil {
		return err
	}

	// Checksum verification only works with full downloads (not resumed)
	enableChecksum := offset == 0
	var checksumAlgorithm ChecksumAlgorithm = ChecksumNone
	var expectedChecksum string

	if enableChecksum && cfg != nil {
		checksumAlgorithm = cfg.ChecksumAlgorithm
		expectedChecksum = cfg.ExpectedChecksum
	}

	input := providers.DownloadObjectInput{
		Bucket:    task.Bucket,
		Key:       task.Key,
		VersionID: task.VersionID,
	}
	if offset > 0 {
		start := offset
		input.RangeStart = &start
	}
	download, err := client.Objects().DownloadObject(ctx, input)
	if err != nil {
		return err
	}
	defer download.Body.Close()

	// Auto-detect checksum from ETag if enabled and no explicit algorithm set
	if enableChecksum && checksumAlgorithm == ChecksumNone && cfg != nil && cfg.ExpectedChecksum == "" {
		if etagChecksum, etagAlg := extractETagChecksum(download.ETag); etagAlg != ChecksumNone {
			checksumAlgorithm = etagAlg
			expectedChecksum = etagChecksum
		}
	}

	file, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open target file: %w", err)
	}
	defer file.Close()
	if offset > 0 {
		if _, err := file.Seek(offset, io.SeekStart); err != nil {
			return fmt.Errorf("seek target file: %w", err)
		}
	} else {
		if err := file.Truncate(0); err != nil {
			return fmt.Errorf("truncate target file: %w", err)
		}
	}
	if task.Total == 0 && download.ContentLength > 0 {
		task.Total = offset + download.ContentLength
	}
	if offset > 0 && task.Progress < offset {
		task.Progress = offset
	}

	// Wrap with progress tracking
	reader := newProgressReader(download.Body, func(n int64) {
		s.updateTaskProgress(task, n)
	})
	var finalReader io.Reader = reader

	// Apply rate limiting if configured
	if s.globalLimiter != nil && s.globalLimiter.Limit() > 0 {
		finalReader = s.wrapWithRateLimiter(ctx, reader)
	}

	// Wrap with checksum calculation if enabled
	var checksumReader *checksumReader
	if enableChecksum && checksumAlgorithm != ChecksumNone {
		checksumReader, err = newChecksumReader(finalReader, checksumAlgorithm)
		if err != nil {
			return fmt.Errorf("create checksum reader: %w", err)
		}
		finalReader = checksumReader
	}

	// Perform the download
	if _, err := io.Copy(file, finalReader); err != nil {
		return fmt.Errorf("write file: %w", err)
	}

	// Store ETag
	if task.ETag == "" {
		task.ETag = download.ETag
	}

	// Store final save path and enhanced metadata
	task.FinalSavePath = target
	task.Duration = time.Since(startTime).Milliseconds()
	if task.Duration > 0 && task.Total > 0 {
		task.AverageSpeed = task.Total * 1000 / task.Duration // bytes per second
	}

	// Verify checksum if enabled
	if checksumReader != nil {
		computed := checksumReader.Sum()
		task.ComputedChecksum = computed

		if err := verifyChecksum(computed, expectedChecksum, checksumAlgorithm); err != nil {
			verified := false
			task.ChecksumVerified = &verified
			return fmt.Errorf("checksum verification failed: %w", err)
		}
		verified := true
		task.ChecksumVerified = &verified
	}

	s.persistTask(task)
	return nil
}

func (s *Service) executeArchiveDownload(ctx context.Context, task *TransferTask) error {
	cfg := task.DownloadConfig
	if cfg == nil || len(cfg.Entries) == 0 {
		return errors.New("archive entries are missing")
	}
	client, err := s.client(ctx, task.AccountID)
	if err != nil {
		return err
	}
	target, err := s.resolveDownloadPath(task)
	if err != nil {
		return err
	}
	file, err := os.Create(target)
	if err != nil {
		return fmt.Errorf("create archive file: %w", err)
	}
	defer file.Close()
	zipWriter := zip.NewWriter(file)
	defer zipWriter.Close()
	for _, entry := range cfg.Entries {
		if entry.IsDir {
			header := &zip.FileHeader{Name: entry.RelativePath}
			header.Method = zip.Store
			if _, err := zipWriter.CreateHeader(header); err != nil {
				return fmt.Errorf("archive directory %s: %w", entry.RelativePath, err)
			}
			continue
		}
		input := providers.DownloadObjectInput{
			Bucket:    entry.Bucket,
			Key:       entry.Key,
			VersionID: entry.VersionID,
		}
		download, err := client.Objects().DownloadObject(ctx, input)
		if err != nil {
			return fmt.Errorf("archive entry %s: %w", entry.Key, err)
		}
		if err := func() error {
			defer download.Body.Close()
			header := &zip.FileHeader{Name: entry.RelativePath, Method: zip.Deflate}
			if entry.Size > 0 {
				header.UncompressedSize64 = uint64(entry.Size)
			}
			writer, err := zipWriter.CreateHeader(header)
			if err != nil {
				return fmt.Errorf("create archive entry %s: %w", entry.RelativePath, err)
			}
			reader := newProgressReader(download.Body, func(n int64) {
				s.updateTaskProgress(task, n)
			})
			written, err := io.Copy(writer, reader)
			if err != nil {
				return fmt.Errorf("write archive entry %s: %w", entry.RelativePath, err)
			}
			if entry.Size <= 0 && written > 0 {
				task.Total += written
			}
			return nil
		}(); err != nil {
			return err
		}
	}
	s.persistTask(task)
	return nil
}

func (s *Service) executeUpload(ctx context.Context, task *TransferTask) error {
	client, err := s.client(ctx, task.AccountID)
	if err != nil {
		return err
	}
	file, err := os.Open(task.LocalPath)
	if err != nil {
		return fmt.Errorf("open source file: %w", err)
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		return fmt.Errorf("stat source file: %w", err)
	}
	if task.Total == 0 {
		task.Total = stat.Size()
		_ = s.store.Update(context.Background(), task)
	}
	reader := newProgressReader(file, func(n int64) {
		s.updateTaskProgress(task, n)
	})
	// Apply global rate limiting if configured
	var finalReader io.Reader = reader
	if s.globalLimiter != nil && s.globalLimiter.Limit() > 0 {
		finalReader = s.wrapWithRateLimiter(ctx, reader)
	}
	contentType := detectContentType(task.Key)
	if err := client.Objects().UploadObject(ctx, task.Bucket, task.Key, finalReader, stat.Size(), contentType); err != nil {
		return err
	}
	s.persistTask(task)
	return nil
}

func (s *Service) executeDownload(ctx context.Context, task *TransferTask) error {
	cfg := task.DownloadConfig
	if cfg != nil && cfg.Mode == DownloadModeArchive {
		return s.executeArchiveDownload(ctx, task)
	}
	return s.executeSingleDownload(ctx, task)
}

func (s *Service) resolveDownloadPath(task *TransferTask) (string, error) {
	target := strings.TrimSpace(task.LocalPath)
	cfg := task.DownloadConfig
	if cfg != nil {
		if cfg.TargetDirectory != "" {
			filename := filepath.Base(target)
			if filename == "" {
				filename = filepath.Base(task.Key)
			}
			if cfg.Mode == DownloadModeArchive && cfg.ArchiveName != "" {
				filename = cfg.ArchiveName
			}
			target = filepath.Join(cfg.TargetDirectory, filename)
		}
		if cfg.Mode == DownloadModeArchive && cfg.ArchiveName != "" {
			target = filepath.Join(filepath.Dir(target), cfg.ArchiveName)
		}
	}
	if target == "" {
		base := task.Key
		if base == "" {
			base = task.ID
		}
		target = filepath.Join(defaultDownloadDir(), filepath.Base(base))
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return "", fmt.Errorf("create parent dir: %w", err)
	}
	info, err := os.Stat(target)
	strategy := ConflictStrategyOverwrite
	if cfg != nil && cfg.ConflictStrategy != "" {
		strategy = cfg.ConflictStrategy
	}
	resume := isResumeEnabled(cfg)
	if err == nil && info.IsDir() {
		filename := filepath.Base(task.Key)
		if cfg != nil && cfg.Mode == DownloadModeArchive && cfg.ArchiveName != "" {
			filename = cfg.ArchiveName
		}
		target = filepath.Join(target, filename)
		info, err = os.Stat(target)
	}
	if err == nil {
		switch {
		case strategy == ConflictStrategyRename:
			target = s.generateUniquePath(target)
		case resume:
			// keep existing file for resume support
		default:
			if removeErr := os.Remove(target); removeErr != nil {
				return "", fmt.Errorf("remove existing file: %w", removeErr)
			}
		}
	} else if !os.IsNotExist(err) {
		return "", fmt.Errorf("inspect target path: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		return "", fmt.Errorf("ensure parent dir: %w", err)
	}
	task.LocalPath = target
	return target, nil
}

func (s *Service) prepareResumeOffset(task *TransferTask, target string, resume bool) (int64, error) {
	if !resume {
		if err := os.Remove(target); err != nil && !os.IsNotExist(err) {
			return 0, fmt.Errorf("reset target file: %w", err)
		}
		task.Progress = 0
		return 0, nil
	}
	info, err := os.Stat(target)
	if err != nil {
		if os.IsNotExist(err) {
			task.Progress = 0
			return 0, nil
		}
		return 0, fmt.Errorf("inspect resume target: %w", err)
	}
	if info.IsDir() {
		return 0, fmt.Errorf("download target %s is a directory", target)
	}
	size := info.Size()
	if size < 0 {
		size = 0
	}
	if task.Progress < size {
		task.Progress = size
	}
	return size, nil
}

func (s *Service) generateUniquePath(path string) string {
	dir := filepath.Dir(path)
	base := filepath.Base(path)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)
	if name == "" {
		name = "download"
	}
	for i := 1; i < 1000; i++ {
		candidate := filepath.Join(dir, fmt.Sprintf("%s (%d)%s", name, i, ext))
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
	return filepath.Join(dir, fmt.Sprintf("%s-%s%s", name, uuid.NewString(), ext))
}

func isResumeEnabled(cfg *DownloadConfig) bool {
	return cfg != nil && cfg.Mode != DownloadModeArchive && cfg.ResumeEnabled
}

func (s *Service) restorePendingTasks() {
	tasks, err := s.store.ListByStatus(context.Background(), TaskPending, TaskRunning)
	if err != nil {
		fmt.Printf("restore transfer tasks failed: %v\n", err)
		return
	}
	for _, task := range tasks {
		if task.Status == TaskRunning {
			task.Status = TaskPending
			task.EndTime = nil
			task.Error = nil
			_ = s.store.Update(context.Background(), task)
		}
		s.enqueue(task.ID, task.Priority)
	}
}

func (s *Service) enqueue(taskID string, priority Priority) {
	if taskID == "" {
		return
	}
	s.queue.Push(taskID, priority)
}

func (s *Service) registerRuntime(taskID string, cancel context.CancelFunc) *taskRuntime {
	s.mu.Lock()
	defer s.mu.Unlock()
	rt := &taskRuntime{cancel: cancel}
	s.runtimes[taskID] = rt
	return rt
}

func (s *Service) unregisterRuntime(taskID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.runtimes, taskID)
}

func (s *Service) requestStop(taskID string, reason stopReason) {
	s.mu.RLock()
	rt := s.runtimes[taskID]
	s.mu.RUnlock()
	if rt == nil {
		return
	}
	rt.setReason(reason)
	if rt.cancel != nil {
		rt.cancel()
	}
}

func (s *Service) updateTaskProgress(task *TransferTask, delta int64) {
	if delta <= 0 || task == nil {
		return
	}
	task.Progress += delta
	now := time.Now()
	if task.lastSampleTime.IsZero() {
		task.lastSampleTime = now
		task.lastSnapshot = task.Progress
		return
	}
	elapsed := now.Sub(task.lastSampleTime)
	if elapsed >= progressSampleThreshold {
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
		switch {
		case remaining <= 0:
			task.EstimatedTime = 0
		case task.Speed > 0:
			task.EstimatedTime = int64(float64(remaining)/float64(task.Speed) + 0.5)
		default:
			task.EstimatedTime = -1
		}
	}
	if task.lastPersisted.IsZero() || now.Sub(task.lastPersisted) >= progressFlushInterval || task.Progress >= task.Total {
		s.persistTask(task)
	}
}

func (s *Service) persistTask(task *TransferTask) {
	if task == nil {
		return
	}
	if err := s.store.Update(context.Background(), task); err == nil {
		task.lastPersisted = time.Now()
	}
}

func (s *Service) client(ctx context.Context, accountID string) (providers.StorageClient, error) {
	accountID = strings.TrimSpace(accountID)
	if accountID == "" {
		return nil, errors.New("account id is required")
	}
	if s.pool == nil {
		return nil, errors.New("storage client pool not configured")
	}
	supplier := func(ctx context.Context) (providers.ConnectionCredentials, error) {
		return s.accounts.ConnectionCredentials(ctx, accountID)
	}
	client, _, err := s.pool.Get(ctx, accountID, supplier)
	if err != nil {
		return nil, err
	}
	return client, nil
}

type progressReader struct {
	reader io.Reader
	notify func(int64)
}

func newProgressReader(r io.Reader, notify func(int64)) io.Reader {
	if notify == nil {
		return r
	}
	return &progressReader{reader: r, notify: notify}
}

func (r *progressReader) Read(p []byte) (int, error) {
	n, err := r.reader.Read(p)
	if n > 0 && r.notify != nil {
		r.notify(int64(n))
	}
	return n, err
}

func detectContentType(key string) string {
	ext := strings.ToLower(filepath.Ext(key))
	if ext == "" {
		return "application/octet-stream"
	}
	if mime := mimeTypeByExtension(ext); mime != "" {
		return mime
	}
	return "application/octet-stream"
}

// mimeTypeByExtension is separated to avoid pulling the entire mime package during tests.
func mimeTypeByExtension(ext string) string { //nolint:unparam
	return mime.TypeByExtension(ext)
}

// computeBackoff returns exponential backoff duration: 1s, 2s, 4s, 8s... capped at 30s.
func (s *Service) computeBackoff(attempt int) time.Duration {
	if attempt <= 0 {
		attempt = 1
	}
	backoff := time.Duration(1<<(attempt-1)) * time.Second
	const maxBackoff = 30 * time.Second
	if backoff > maxBackoff {
		backoff = maxBackoff
	}
	return backoff
}

// wrapWithRateLimiter wraps a reader with rate limiting.
func (s *Service) wrapWithRateLimiter(ctx context.Context, r io.Reader) io.Reader {
	if s.globalLimiter == nil {
		return r
	}
	return &rateLimitedReader{
		reader:  r,
		limiter: s.globalLimiter,
		ctx:     ctx,
	}
}

// rateLimitedReader wraps an io.Reader and applies rate limiting.
// Tokens are consumed AFTER read based on actual bytes read, not buffer size.
type rateLimitedReader struct {
	reader  io.Reader
	limiter *RateLimiter
	ctx     context.Context
}

func (r *rateLimitedReader) Read(p []byte) (int, error) {
	// Read first, then consume tokens based on actual bytes read
	n, err := r.reader.Read(p)
	if n > 0 {
		// Consume tokens based on actual bytes read
		if waitErr := r.limiter.WaitAndConsume(r.ctx, int64(n)); waitErr != nil {
			return n, waitErr
		}
	}
	return n, err
}
