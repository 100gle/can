package transfer

import (
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
	"can/internal/providers"
	"can/internal/security"
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

func newTestTransferService(t *testing.T, driver providers.ObjectDriver) (*Service, string) {
	t.Helper()
	store := accounts.NewMemoryStore()
	cipher := security.NoopCipher{}
	dialer := providers.NewStubDialer()
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
	pool := providers.NewClientPool(factory)
	accountSvc.SetClientPool(pool)
	transferStore := NewMemoryStore()
	svc := NewService(accountSvc, pool, transferStore, WithWorkerCount(1), WithQueueSize(1))
	return svc, account.ID
}

type fakeStorageFactory struct {
	client providers.StorageClient
}

func (f *fakeStorageFactory) NewClient(context.Context, providers.ConnectionCredentials) (providers.StorageClient, error) {
	if f.client == nil {
		return nil, errors.New("missing storage client")
	}
	return f.client, nil
}

type fakeStorageClient struct {
	objects providers.ObjectDriver
}

func (f *fakeStorageClient) Provider() types.Provider {
	return types.ProviderAWS
}

func (f *fakeStorageClient) Capabilities() []types.ProviderCapability {
	return nil
}

func (f *fakeStorageClient) Buckets() providers.BucketDriver {
	return nil
}

func (f *fakeStorageClient) Objects() providers.ObjectDriver {
	return f.objects
}

type fakeObjectDriver struct {
	mu      sync.Mutex
	objects map[string][]byte
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

func (d *fakeObjectDriver) ListObjects(context.Context, providers.ListObjectsInput) (providers.ListObjectsResult, error) {
	return providers.ListObjectsResult{}, nil
}

func (d *fakeObjectDriver) UploadObject(ctx context.Context, bucket, key string, body io.Reader, _ int64, _ string) error {
	payload, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	d.store(bucket, key, payload)
	return nil
}

func (d *fakeObjectDriver) DownloadObject(ctx context.Context, bucket, key string) (providers.ObjectDownload, error) {
	data := d.object(bucket, key)
	if len(data) == 0 {
		return providers.ObjectDownload{}, errors.New("object not found")
	}
	reader := io.NopCloser(bytes.NewReader(data))
	return providers.ObjectDownload{
		Body:          reader,
		ContentLength: int64(len(data)),
	}, nil
}

func (d *fakeObjectDriver) DeleteObject(context.Context, string, string) error {
	return nil
}

func (d *fakeObjectDriver) CopyObject(context.Context, string, string, string, string) error {
	return nil
}

func (d *fakeObjectDriver) HeadObject(context.Context, string, string) (providers.ObjectDescriptor, error) {
	return providers.ObjectDescriptor{}, nil
}

func (d *fakeObjectDriver) PresignURL(context.Context, string, string, time.Duration, string) (string, error) {
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
