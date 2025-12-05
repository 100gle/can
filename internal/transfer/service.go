package transfer

import (
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
}

// DownloadRequest describes the metadata required to enqueue a download task.
type DownloadRequest struct {
	AccountID string
	Bucket    string
	Key       string
	SavePath  string
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

	queue   chan string
	workers int

	mu       sync.RWMutex
	runtimes map[string]*taskRuntime
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
		accounts: accounts,
		pool:     pool,
		store:    store,
		queue:    make(chan string, cfg.queueSize),
		workers:  cfg.workers,
		runtimes: make(map[string]*taskRuntime),
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
	s.enqueue(task.ID)
	return task.clone(), nil
}

// EnqueueDownload creates a transfer task for downloading a remote object.
func (s *Service) EnqueueDownload(ctx context.Context, req DownloadRequest) (*TransferTask, error) {
	req.AccountID = strings.TrimSpace(req.AccountID)
	req.Bucket = strings.TrimSpace(req.Bucket)
	req.Key = strings.TrimSpace(req.Key)
	req.SavePath = strings.TrimSpace(req.SavePath)
	if req.AccountID == "" {
		return nil, errors.New("account id is required")
	}
	if req.Bucket == "" {
		return nil, errors.New("bucket is required")
	}
	if req.Key == "" {
		return nil, errors.New("object key is required")
	}
	if req.SavePath == "" {
		req.SavePath = filepath.Join(os.TempDir(), filepath.Base(req.Key))
	}
	task := &TransferTask{
		ID:             uuid.NewString(),
		Type:           TaskTypeDownload,
		AccountID:      req.AccountID,
		Bucket:         req.Bucket,
		Key:            req.Key,
		LocalPath:      req.SavePath,
		Status:         TaskPending,
		EstimatedTime:  -1,
		StartTime:      time.Now(),
		MaxRetries:     3,
		lastSampleTime: time.Now(),
		lastSnapshot:   0,
	}
	if err := s.store.Create(ctx, task); err != nil {
		return nil, err
	}
	s.enqueue(task.ID)
	return task.clone(), nil
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
	s.enqueue(task.ID)
	return nil
}

func (s *Service) startWorkers() {
	for i := 0; i < s.workers; i++ {
		go s.worker()
	}
}

func (s *Service) worker() {
	for taskID := range s.queue {
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
	contentType := detectContentType(task.Key)
	if err := client.Objects().UploadObject(ctx, task.Bucket, task.Key, reader, stat.Size(), contentType); err != nil {
		return err
	}
	s.persistTask(task)
	return nil
}

func (s *Service) executeDownload(ctx context.Context, task *TransferTask) error {
	client, err := s.client(ctx, task.AccountID)
	if err != nil {
		return err
	}
	download, err := client.Objects().DownloadObject(ctx, task.Bucket, task.Key)
	if err != nil {
		return err
	}
	defer download.Body.Close()
	if download.ContentLength > 0 && task.Total == 0 {
		task.Total = download.ContentLength
		_ = s.store.Update(context.Background(), task)
	}
	target, err := s.resolveDownloadPath(task)
	if err != nil {
		return err
	}
	s.persistTask(task)
	file, err := os.Create(target)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer file.Close()
	reader := newProgressReader(download.Body, func(n int64) {
		s.updateTaskProgress(task, n)
	})
	if _, err := io.Copy(file, reader); err != nil {
		return fmt.Errorf("write file: %w", err)
	}
	s.persistTask(task)
	return nil
}

func (s *Service) resolveDownloadPath(task *TransferTask) (string, error) {
	target := strings.TrimSpace(task.LocalPath)
	if target == "" {
		target = filepath.Join(os.TempDir(), filepath.Base(task.Key))
	}
	info, err := os.Stat(target)
	switch {
	case err == nil && info.IsDir():
		target = filepath.Join(target, filepath.Base(task.Key))
	case err == nil:
		// file exists, reuse path
	case os.IsNotExist(err):
		if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
			return "", fmt.Errorf("create parent dir: %w", err)
		}
	default:
		return "", fmt.Errorf("inspect target path: %w", err)
	}
	task.LocalPath = target
	return target, nil
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
		s.enqueue(task.ID)
	}
}

func (s *Service) enqueue(taskID string) {
	if taskID == "" {
		return
	}
	select {
	case s.queue <- taskID:
	default:
		go func(id string) {
			s.queue <- id
		}(taskID)
	}
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
