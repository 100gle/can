package objects

import (
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/security"
	"can/internal/types"
)

func TestRenameObjectSucceeds(t *testing.T) {
	driver := newStubObjectDriver()
	driver.headResponses[driver.key("docs", "renamed.txt")] = headResponse{err: errors.New("对象不存在")}
	svc, accountID := newTestObjectsService(t, driver)
	ctx := context.Background()
	if err := svc.RenameObject(ctx, accountID, "docs", "old.txt", "renamed.txt"); err != nil {
		t.Fatalf("rename object: %v", err)
	}
	if len(driver.copyCalls) != 1 {
		t.Fatalf("expected 1 copy call, got %d", len(driver.copyCalls))
	}
	if call := driver.copyCalls[0]; call.sourceBucket != "docs" || call.sourceKey != "old.txt" || call.targetBucket != "docs" || call.targetKey != "renamed.txt" {
		t.Fatalf("unexpected copy call: %+v", call)
	}
	if len(driver.deleteCalls) != 1 {
		t.Fatalf("expected 1 delete call, got %d", len(driver.deleteCalls))
	}
	if call := driver.deleteCalls[0]; call.bucket != "docs" || call.key != "old.txt" {
		t.Fatalf("unexpected delete call: %+v", call)
	}
}

func TestRenameObjectRejectsExistingTarget(t *testing.T) {
	driver := newStubObjectDriver()
	driver.headResponses[driver.key("main", "existing.txt")] = headResponse{}
	svc, accountID := newTestObjectsService(t, driver)
	err := svc.RenameObject(context.Background(), accountID, "main", "old.txt", "existing.txt")
	if err == nil {
		t.Fatalf("expected error when target exists")
	}
}

func TestRenameObjectPropagatesHeadErrors(t *testing.T) {
	driver := newStubObjectDriver()
	boom := errors.New("head failure")
	driver.headResponses[driver.key("logs", "next.txt")] = headResponse{err: boom}
	svc, accountID := newTestObjectsService(t, driver)
	err := svc.RenameObject(context.Background(), accountID, "logs", "prev.txt", "next.txt")
	if !errors.Is(err, boom) {
		t.Fatalf("expected head error to propagate, got %v", err)
	}
}

func TestRenameObjectStopsAfterCopyFailure(t *testing.T) {
	driver := newStubObjectDriver()
	driver.headResponses[driver.key("media", "new.mov")] = headResponse{err: errors.New("not found")}
	driver.copyErr = errors.New("copy failed")
	svc, accountID := newTestObjectsService(t, driver)
	err := svc.RenameObject(context.Background(), accountID, "media", "old.mov", "new.mov")
	if !errors.Is(err, driver.copyErr) {
		t.Fatalf("expected copy error, got %v", err)
	}
	if len(driver.deleteCalls) != 0 {
		t.Fatalf("expected no delete call when copy fails")
	}
}

func TestRenameObjectValidatesKeys(t *testing.T) {
	svc, accountID := newTestObjectsService(t, newStubObjectDriver())
	if err := svc.RenameObject(context.Background(), accountID, "docs", "same.txt", "same.txt"); err == nil {
		t.Fatalf("expected error when keys are identical")
	}
}

type stubObjectDriver struct {
	headResponses map[string]headResponse
	copyCalls     []copyCall
	deleteCalls   []deleteCall
	copyErr       error
	deleteErr     error
}

type headResponse struct {
	desc providers.ObjectDescriptor
	err  error
}

type copyCall struct {
	sourceBucket string
	sourceKey    string
	targetBucket string
	targetKey    string
}

type deleteCall struct {
	bucket string
	key    string
}

func newStubObjectDriver() *stubObjectDriver {
	return &stubObjectDriver{headResponses: make(map[string]headResponse)}
}

func (s *stubObjectDriver) key(bucket, key string) string {
	return bucket + ":" + key
}

func (s *stubObjectDriver) ListObjects(context.Context, providers.ListObjectsInput) (providers.ListObjectsResult, error) {
	return providers.ListObjectsResult{}, nil
}

func (s *stubObjectDriver) UploadObject(context.Context, string, string, io.Reader, int64, string) error {
	return nil
}

func (s *stubObjectDriver) DownloadObject(context.Context, string, string) (providers.ObjectDownload, error) {
	return providers.ObjectDownload{}, nil
}

func (s *stubObjectDriver) PresignURL(context.Context, string, string, time.Duration, string) (string, error) {
	return "", nil
}

func (s *stubObjectDriver) InitiateMultipartUpload(context.Context, string, string) (string, error) {
	return "", nil
}

func (s *stubObjectDriver) UploadPart(context.Context, string, string, string, int, io.Reader, int64) (string, error) {
	return "", nil
}

func (s *stubObjectDriver) CompleteMultipartUpload(context.Context, string, string, string, map[int]string) error {
	return nil
}

func (s *stubObjectDriver) AbortMultipartUpload(context.Context, string, string, string) error {
	return nil
}

func (s *stubObjectDriver) GetObjectTags(context.Context, string, string) (map[string]string, error) {
	return nil, nil
}

func (s *stubObjectDriver) DeleteObject(_ context.Context, bucket, key string) error {
	s.deleteCalls = append(s.deleteCalls, deleteCall{bucket: bucket, key: key})
	if s.deleteErr != nil {
		return s.deleteErr
	}
	return nil
}

func (s *stubObjectDriver) CopyObject(_ context.Context, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	s.copyCalls = append(s.copyCalls, copyCall{
		sourceBucket: sourceBucket,
		sourceKey:    sourceKey,
		targetBucket: targetBucket,
		targetKey:    targetKey,
	})
	if s.copyErr != nil {
		return s.copyErr
	}
	return nil
}

func (s *stubObjectDriver) HeadObject(_ context.Context, bucket, key string) (providers.ObjectDescriptor, error) {
	resp, ok := s.headResponses[s.key(bucket, key)]
	if !ok {
		return providers.ObjectDescriptor{}, errors.New("head response not configured")
	}
	return resp.desc, resp.err
}

type stubStorageFactory struct {
	client providers.StorageClient
}

func (s *stubStorageFactory) NewClient(context.Context, providers.ConnectionCredentials) (providers.StorageClient, error) {
	if s.client == nil {
		return nil, errors.New("missing storage client")
	}
	return s.client, nil
}

type stubStorageClient struct {
	objects providers.ObjectDriver
}

func (s *stubStorageClient) Provider() types.Provider {
	return types.ProviderAWS
}

func (s *stubStorageClient) Capabilities() []types.ProviderCapability {
	return nil
}

func (s *stubStorageClient) Buckets() providers.BucketDriver {
	return nil
}

func (s *stubStorageClient) Objects() providers.ObjectDriver {
	return s.objects
}

func newTestObjectsService(t *testing.T, driver providers.ObjectDriver) (*Service, string) {
	t.Helper()
	store := accounts.NewMemoryStore()
	cipher := security.NoopCipher{}
	dialer := providers.NewStubDialer()
	session := accounts.NewMemorySessionStore()
	accountSvc := accounts.NewService(store, cipher, dialer, session)
	ctx := context.Background()
	account, err := accountSvc.CreateAccount(ctx, accounts.CreateAccountInput{
		Name:            "Test Account",
		Provider:        types.ProviderAWS,
		Endpoint:        "https://s3.example.com",
		AccessKeyID:     "AKIA-TEST",
		SecretAccessKey: "secret",
		Region:          "us-east-1",
		UseSSL:          true,
		Port:            443,
	})
	if err != nil {
		t.Fatalf("create account: %v", err)
	}
	factory := &stubStorageFactory{client: &stubStorageClient{objects: driver}}
	service := NewService(accountSvc, factory, nil)
	return service, account.ID
}
