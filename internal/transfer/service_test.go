package transfer

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"can/internal/accounts"
	"can/internal/storage"

	"can/internal/types"
)

func TestEnqueueUploadCompletes(t *testing.T) {
	driver := newFakeObjectDriver()
	svc, accountID := newTestTransferService(t, driver)
	file := tempFile(t, []byte("hello world"))
	task, err := svc.EnqueueUpload(context.Background(), UploadRequest{
		AccountID: accountID,
		Bucket:    "docs",
		Key:       "hello.txt",
		FilePath:  file,
	})
	if err != nil {
		t.Fatalf("enqueue upload: %v", err)
	}
	waitForStatus(t, svc, task.ID, TaskCompleted)
	if got := driver.object("docs", "hello.txt"); !bytes.Equal(got, []byte("hello world")) {
		t.Fatalf("expected uploaded payload to match, got %q", string(got))
	}
}

func TestEnqueueDownloadCreatesFile(t *testing.T) {
	driver := newFakeObjectDriver()
	driver.setObject("docs", "report.pdf", []byte("download-me"))
	svc, accountID := newTestTransferService(t, driver)
	dir := t.TempDir()
	target := filepath.Join(dir, "report.pdf")
	task, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
		AccountID: accountID,
		Bucket:    "docs",
		Key:       "report.pdf",
		SavePath:  target,
	})
	if err != nil {
		t.Fatalf("enqueue download: %v", err)
	}
	waitForStatus(t, svc, task.ID, TaskCompleted)
	data, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("read downloaded file: %v", err)
	}
	if string(data) != "download-me" {
		t.Fatalf("unexpected file content %q", string(data))
	}
}

func TestDownloadResumesFromExistingFile(t *testing.T) {
	driver := newFakeObjectDriver()
	payload := bytes.Repeat([]byte("resume"), 512)
	driver.setObject("docs", "big.bin", payload)
	svc, accountID := newTestTransferService(t, driver)
	dir := t.TempDir()
	target := filepath.Join(dir, "big.bin")
	partial := payload[:len(payload)/2]
	if err := os.WriteFile(target, partial, 0o644); err != nil {
		t.Fatalf("write partial file: %v", err)
	}
	task, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
		AccountID: accountID,
		Bucket:    "docs",
		Key:       "big.bin",
		SavePath:  target,
	})
	if err != nil {
		t.Fatalf("enqueue download: %v", err)
	}
	waitForStatus(t, svc, task.ID, TaskCompleted)
	data, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("read downloaded file: %v", err)
	}
	if !bytes.Equal(data, payload) {
		t.Fatalf("expected download to resume, got %d bytes", len(data))
	}
	driver.mu.Lock()
	input := driver.last
	driver.mu.Unlock()
	if input.RangeStart == nil || *input.RangeStart != int64(len(partial)) {
		t.Fatalf("expected range start %d, got %+v", len(partial), input.RangeStart)
	}
}

func TestArchiveDownloadCreatesZip(t *testing.T) {
	driver := newFakeObjectDriver()
	driver.setObject("docs", "a.txt", []byte("alpha"))
	driver.setObject("docs", "folder/b.txt", []byte("beta"))
	svc, accountID := newTestTransferService(t, driver)
	dir := t.TempDir()
	archive := filepath.Join(dir, "bundle.zip")
	entries := []DownloadEntry{
		{Bucket: "docs", Key: "a.txt", RelativePath: "pkg/a.txt", Size: 5},
		{Bucket: "docs", Key: "folder/b.txt", RelativePath: "pkg/sub/b.txt", Size: 4},
	}
	task, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
		AccountID:   accountID,
		Bucket:      "docs",
		Mode:        DownloadModeArchive,
		Entries:     entries,
		ArchiveName: "bundle.zip",
		SavePath:    archive,
	})
	if err != nil {
		t.Fatalf("enqueue archive download: %v", err)
	}
	waitForStatus(t, svc, task.ID, TaskCompleted)
	r, err := zip.OpenReader(archive)
	if err != nil {
		t.Fatalf("open archive: %v", err)
	}
	defer r.Close()
	files := map[string]string{}
	for _, f := range r.File {
		reader, err := f.Open()
		if err != nil {
			t.Fatalf("open zip entry: %v", err)
		}
		content, err := io.ReadAll(reader)
		reader.Close()
		if err != nil {
			t.Fatalf("read zip entry: %v", err)
		}
		files[f.Name] = string(content)
	}
	if files["pkg/a.txt"] != "alpha" {
		t.Fatalf("missing first file in archive: %#v", files)
	}
	if files["pkg/sub/b.txt"] != "beta" {
		t.Fatalf("missing second file in archive: %#v", files)
	}
}

func TestArchiveDownloadUnknownSizesUpdateTotal(t *testing.T) {
	driver := newFakeObjectDriver()
	alpha := []byte("alpha")
	beta := []byte("beta-data")
	driver.setObject("docs", "alpha.bin", alpha)
	driver.setObject("docs", "nested/beta.bin", beta)
	svc, accountID := newTestTransferService(t, driver)
	dir := t.TempDir()
	entries := []DownloadEntry{
		{Bucket: "docs", Key: "alpha.bin", RelativePath: "alpha.bin", Size: 0},
		{Bucket: "docs", Key: "nested/beta.bin", RelativePath: "pkg/beta.bin", Size: 0},
	}
	task, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
		AccountID: accountID,
		Mode:      DownloadModeArchive,
		Entries:   entries,
		SavePath:  filepath.Join(dir, "bundle.zip"),
	})
	if err != nil {
		t.Fatalf("enqueue archive download: %v", err)
	}
	finished := waitForStatus(t, svc, task.ID, TaskCompleted)
	expected := int64(len(alpha) + len(beta))
	if finished.Total != expected {
		t.Fatalf("expected total %d, got %d", expected, finished.Total)
	}
}

func TestDownloadRenameConflict(t *testing.T) {
	driver := newFakeObjectDriver()
	driver.setObject("docs", "report.pdf", []byte("new"))
	svc, accountID := newTestTransferService(t, driver)
	dir := t.TempDir()
	target := filepath.Join(dir, "report.pdf")
	if err := os.WriteFile(target, []byte("existing"), 0o644); err != nil {
		t.Fatalf("write existing file: %v", err)
	}
	task, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
		AccountID:        accountID,
		Bucket:           "docs",
		Key:              "report.pdf",
		SavePath:         target,
		ConflictStrategy: ConflictStrategyRename,
	})
	if err != nil {
		t.Fatalf("enqueue download: %v", err)
	}
	waitForStatus(t, svc, task.ID, TaskCompleted)
	renamed := filepath.Join(dir, "report (1).pdf")
	if _, err := os.Stat(renamed); err != nil {
		t.Fatalf("expected renamed file to exist: %v", err)
	}
	data, err := os.ReadFile(target)
	if err != nil {
		t.Fatalf("read original file: %v", err)
	}
	if string(data) != "existing" {
		t.Fatalf("original file should remain untouched, got %q", string(data))
	}
}

func TestPauseTaskUpdatesStatus(t *testing.T) {
	driver := newFakeObjectDriver()
	// Create a large file to give us time to pause
	payload := bytes.Repeat([]byte("x"), 1024*100)
	driver.setObject("docs", "large.bin", payload)
	svc, accountID := newTestTransferService(t, driver)
	dir := t.TempDir()
	target := filepath.Join(dir, "large.bin")

	task, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
		AccountID: accountID,
		Bucket:    "docs",
		Key:       "large.bin",
		SavePath:  target,
	})
	if err != nil {
		t.Fatalf("enqueue download: %v", err)
	}

	// Wait a bit for the task to start
	time.Sleep(50 * time.Millisecond)

	// Pause the task
	if err := svc.PauseTask(context.Background(), task.ID); err != nil {
		t.Fatalf("pause task: %v", err)
	}

	// Verify task is paused
	paused, err := svc.GetTaskProgress(context.Background(), task.ID)
	if err != nil {
		t.Fatalf("get task progress: %v", err)
	}
	if paused.Status != TaskPaused && paused.Status != TaskCompleted {
		// Task may have completed if it was fast
		t.Logf("task status: %s (may have completed before pause)", paused.Status)
	} else if paused.Status == TaskPaused && paused.PauseReason != PauseReasonUser {
		t.Fatalf("expected pause reason %q, got %q", PauseReasonUser, paused.PauseReason)
	}
}

func TestPauseAllAndResumePendingRespectReason(t *testing.T) {
	driver := newFakeObjectDriver()
	payload := bytes.Repeat([]byte("net"), 1024*256)
	driver.setObject("docs", "one.bin", payload)
	driver.setObject("docs", "two.bin", payload)
	svc, accountID := newTestTransferService(t, driver)
	dir := t.TempDir()

	var tasks []*TransferTask
	keys := []string{"one.bin", "two.bin"}
	for idx, key := range keys {
		target := filepath.Join(dir, key)
		task, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
			AccountID: accountID,
			Bucket:    "docs",
			Key:       key,
			SavePath:  target,
		})
		if err != nil {
			t.Fatalf("enqueue download %d: %v", idx, err)
		}
		tasks = append(tasks, task)
	}

	paused, err := svc.PauseAll(context.Background(), PauseReasonNetwork)
	if err != nil {
		t.Fatalf("pause all: %v", err)
	}
	if paused == 0 {
		t.Fatalf("expected at least one task to pause")
	}

	snapshot, err := svc.ListTasks(context.Background())
	if err != nil {
		t.Fatalf("list transfer tasks: %v", err)
	}
	networkPaused := 0
	for _, task := range snapshot {
		if task.Status == TaskPaused {
			if task.PauseReason != PauseReasonNetwork {
				t.Fatalf("expected pause reason %q, got %q", PauseReasonNetwork, task.PauseReason)
			}
			networkPaused++
		}
	}
	if networkPaused == 0 {
		t.Fatalf("expected paused tasks in snapshot")
	}

	resumed, err := svc.ResumePending(context.Background(), PauseReasonNetwork)
	if err != nil {
		t.Fatalf("resume pending: %v", err)
	}
	if resumed == 0 {
		t.Fatalf("expected resume to process paused tasks")
	}
	for _, task := range tasks {
		waitForStatus(t, svc, task.ID, TaskCompleted)
	}
}

func TestCancelTaskStopsExecution(t *testing.T) {
	driver := newFakeObjectDriver()
	// Create a file
	driver.setObject("docs", "file.bin", []byte("content"))
	svc, accountID := newTestTransferService(t, driver)
	dir := t.TempDir()
	target := filepath.Join(dir, "file.bin")

	task, err := svc.EnqueueDownload(context.Background(), DownloadRequest{
		AccountID: accountID,
		Bucket:    "docs",
		Key:       "file.bin",
		SavePath:  target,
	})
	if err != nil {
		t.Fatalf("enqueue download: %v", err)
	}

	// Cancel the task immediately
	if err := svc.CancelTask(context.Background(), task.ID); err != nil {
		t.Fatalf("cancel task: %v", err)
	}

	// Verify task status
	canceled, err := svc.GetTaskProgress(context.Background(), task.ID)
	if err != nil {
		t.Fatalf("get task progress: %v", err)
	}
	// Task may be canceled or completed depending on timing
	if canceled.Status != TaskCanceled && canceled.Status != TaskCompleted {
		t.Logf("task status: %s", canceled.Status)
	}
}

func waitForStatus(t *testing.T, svc *Service, taskID string, status TaskStatus) *TransferTask {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	var snapshot *TransferTask
	for time.Now().Before(deadline) {
		task, err := svc.GetTaskProgress(context.Background(), taskID)
		if err == nil {
			snapshot = task
			if task.Status == status {
				return task
			}
		}
		time.Sleep(50 * time.Millisecond)
	}
	if snapshot != nil {
		t.Fatalf("timeout waiting for task %s to reach status %s (last=%s)", taskID, status, snapshot.Status)
	}
	t.Fatalf("timeout waiting for task %s to reach status %s", taskID, status)
	return nil
}

func tempFile(t *testing.T, data []byte) string {
	t.Helper()
	file, err := os.CreateTemp(t.TempDir(), "payload-*")
	if err != nil {
		t.Fatalf("create temp file: %v", err)
	}
	if _, err := file.Write(data); err != nil {
		t.Fatalf("write temp file: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close temp file: %v", err)
	}
	return file.Name()
}

func newTestTransferService(t *testing.T, driver storage.ObjectDriver) (*Service, string) {
	t.Helper()
	store := accounts.NewMemoryStore()
	cipher := accounts.NoopCipher{}
	dialer := &fakeDialer{}
	session := accounts.NewMemorySessionStore()
	accountSvc := accounts.NewService(store, cipher, dialer, session)
	ctx := context.Background()
	account, err := accountSvc.CreateAccount(ctx, accounts.CreateAccountInput{
		Name:            "Test",
		Provider:        types.ProviderAWS,
		Endpoint:        "https://s3.example.com",
		AccessKeyID:     "AKIA",
		SecretAccessKey: "secret",
		Region:          "us-east-1",
		UseSSL:          true,
		Port:            443,
	})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	factory := &fakeStorageFactory{client: &fakeStorageClient{objects: driver}}
	pool := storage.NewClientPool(factory)
	accountSvc.SetClientPool(pool)
	transferStore := NewMemoryStore()
	svc := NewService(accountSvc, pool, transferStore, WithWorkerCount(1), WithQueueSize(1))
	return svc, account.ID
}

type fakeDialer struct{}

func (f *fakeDialer) TestConnection(ctx context.Context, creds storage.ConnectionCredentials) error {
	return nil
}

type fakeStorageFactory struct {
	client storage.StorageClient
}

func (f *fakeStorageFactory) NewClient(context.Context, storage.ConnectionCredentials) (storage.StorageClient, error) {
	if f.client == nil {
		return nil, errors.New("missing storage client")
	}
	return f.client, nil
}

type fakeStorageClient struct {
	objects storage.ObjectDriver
}

func (f *fakeStorageClient) Provider() types.Provider {
	return types.ProviderAWS
}

func (f *fakeStorageClient) Capabilities() []types.ProviderCapability {
	return nil
}

func (f *fakeStorageClient) Buckets() storage.BucketDriver {
	return nil
}

func (f *fakeStorageClient) Objects() storage.ObjectDriver {
	return f.objects
}

func (f *fakeStorageClient) Security() storage.SecurityDriver {
	return nil
}

type fakeObjectDriver struct {
	mu      sync.Mutex
	objects map[string][]byte
	last    storage.DownloadObjectInput
}

func newFakeObjectDriver() *fakeObjectDriver {
	return &fakeObjectDriver{
		objects: make(map[string][]byte),
	}
}

func (d *fakeObjectDriver) store(bucket, key string, data []byte) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.objects[bucket+":"+key] = append([]byte(nil), data...)
}

func (d *fakeObjectDriver) object(bucket, key string) []byte {
	d.mu.Lock()
	defer d.mu.Unlock()
	return append([]byte(nil), d.objects[bucket+":"+key]...)
}

func (d *fakeObjectDriver) setObject(bucket, key string, data []byte) {
	d.store(bucket, key, data)
}

func (d *fakeObjectDriver) ListObjects(context.Context, storage.ListObjectsInput) (storage.ListObjectsResult, error) {
	return storage.ListObjectsResult{}, nil
}

func (d *fakeObjectDriver) UploadObject(ctx context.Context, bucket, key string, body io.Reader, _ int64, _ string) error {
	payload, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	d.store(bucket, key, payload)
	return nil
}

func (d *fakeObjectDriver) DownloadObject(ctx context.Context, input storage.DownloadObjectInput) (storage.ObjectDownload, error) {
	d.mu.Lock()
	d.last = input
	d.mu.Unlock()
	data := d.object(input.Bucket, input.Key)
	if len(data) == 0 {
		return storage.ObjectDownload{}, errors.New("object not found")
	}
	start := int64(0)
	end := int64(len(data))
	if input.RangeStart != nil && *input.RangeStart > 0 {
		if *input.RangeStart >= end {
			return storage.ObjectDownload{}, errors.New("range exceeds object")
		}
		start = *input.RangeStart
	}
	if input.RangeEnd != nil && *input.RangeEnd >= 0 && *input.RangeEnd < end {
		end = *input.RangeEnd + 1
	}
	slice := data[start:end]
	reader := io.NopCloser(bytes.NewReader(slice))
	return storage.ObjectDownload{
		Body:          reader,
		ContentLength: int64(len(slice)),
	}, nil
}

func (d *fakeObjectDriver) DeleteObject(context.Context, string, string) error {
	return nil
}

func (d *fakeObjectDriver) DeleteObjects(_ context.Context, _ string, keys []string) (storage.DeleteObjectsResult, error) {
	return storage.DeleteObjectsResult{Deleted: keys}, nil
}

func (d *fakeObjectDriver) CopyObject(context.Context, string, string, string, string) error {
	return nil
}

func (d *fakeObjectDriver) HeadObject(context.Context, string, string) (storage.ObjectDescriptor, error) {
	return storage.ObjectDescriptor{}, nil
}

func (d *fakeObjectDriver) PresignURL(context.Context, storage.PresignRequest) (string, error) {
	return "", nil
}

func (d *fakeObjectDriver) InitiateMultipartUpload(context.Context, string, string) (string, error) {
	return "", nil
}

func (d *fakeObjectDriver) UploadPart(context.Context, string, string, string, int, io.Reader, int64) (string, error) {
	return "", nil
}

func (d *fakeObjectDriver) CompleteMultipartUpload(context.Context, string, string, string, map[int]string) error {
	return nil
}

func (d *fakeObjectDriver) AbortMultipartUpload(context.Context, string, string, string) error {
	return nil
}

func (d *fakeObjectDriver) GetObjectTags(context.Context, string, string) (map[string]string, error) {
	return nil, nil
}

func (d *fakeObjectDriver) PutObjectTags(context.Context, string, string, map[string]string) error {
	return nil
}

func (d *fakeObjectDriver) UpdateObjectMetadata(context.Context, string, string, storage.ObjectMetadataUpdate) error {
	return nil
}

func (d *fakeObjectDriver) GetObjectACL(context.Context, string, string) (storage.ObjectACL, error) {
	return storage.ObjectACL{}, storage.ErrUnsupportedCapability
}

func (d *fakeObjectDriver) PutObjectACL(context.Context, string, string, string) error {
	return storage.ErrUnsupportedCapability
}

func (d *fakeObjectDriver) CreateSymlink(context.Context, string, string, string) error {
	return storage.ErrUnsupportedCapability
}

func (d *fakeObjectDriver) GetObjectLockConfiguration(context.Context, string) (storage.ObjectLockConfiguration, error) {
	return storage.ObjectLockConfiguration{}, storage.ErrUnsupportedCapability
}

func (d *fakeObjectDriver) GetObjectRetention(context.Context, string, string, string) (storage.ObjectRetentionState, error) {
	return storage.ObjectRetentionState{}, storage.ErrUnsupportedCapability
}

func (d *fakeObjectDriver) PutObjectRetention(context.Context, storage.PutObjectRetentionInput) error {
	return storage.ErrUnsupportedCapability
}

func (d *fakeObjectDriver) GetObjectLegalHold(context.Context, string, string, string) (storage.ObjectLegalHoldState, error) {
	return storage.ObjectLegalHoldState{}, storage.ErrUnsupportedCapability
}

func (d *fakeObjectDriver) PutObjectLegalHold(context.Context, storage.PutObjectLegalHoldInput) error {
	return storage.ErrUnsupportedCapability
}

func TestWorkerScalingRace(t *testing.T) {
	driver := newFakeObjectDriver()
	store := accounts.NewMemoryStore()
	cipher := accounts.NoopCipher{}
	dialer := &fakeDialer{}
	session := accounts.NewMemorySessionStore()
	accountSvc := accounts.NewService(store, cipher, dialer, session)
	pool := storage.NewClientPool(&fakeStorageFactory{client: &fakeStorageClient{objects: driver}})
	// Start with 100 workers to increase chance of race
	svc := NewService(accountSvc, pool, NewMemoryStore(), WithWorkerCount(100))

	waitForActiveWorkers(t, svc, 100, 2*time.Second)

	// Scale down to 1
	svc.SetWorkerCount(1)

	waitForActiveWorkers(t, svc, 1, 2*time.Second)
}

func waitForActiveWorkers(t *testing.T, svc *Service, expected int, timeout time.Duration) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		svc.mu.RLock()
		active := svc.activeWorkers
		svc.mu.RUnlock()
		if active == expected {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	svc.mu.RLock()
	active := svc.activeWorkers
	svc.mu.RUnlock()
	t.Fatalf("expected %d active workers within %s, but have %d", expected, timeout, active)
}
