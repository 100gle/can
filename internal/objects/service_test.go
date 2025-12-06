package objects

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

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

func TestMoveObjectsMovesAndDeletes(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)
	ctx := context.Background()
	reqs := []MoveObjectRequest{
		{SourceBucket: "src", SourceKey: "a.txt", TargetBucket: "dst", TargetKey: "b.txt"},
	}
	result, err := svc.MoveObjects(ctx, accountID, reqs)
	if err != nil {
		t.Fatalf("move objects: %v", err)
	}
	if result.Succeeded != 1 || len(result.Failed) != 0 {
		t.Fatalf("unexpected move result: %+v", result)
	}
	if len(driver.copyCalls) != 1 {
		t.Fatalf("expected copy call")
	}
	if len(driver.deleteCalls) != 1 {
		t.Fatalf("expected delete call")
	}
}

func TestCreateFolderValidatesInputs(t *testing.T) {
	svc, accountID := newTestObjectsService(t, newStubObjectDriver())
	ctx := context.Background()
	if err := svc.CreateFolder(ctx, accountID, "", "prefix"); err == nil {
		t.Fatalf("expected error when bucket missing")
	}
	if err := svc.CreateFolder(ctx, accountID, "docs", ""); err == nil {
		t.Fatalf("expected error when folder name missing")
	}
}

func TestUpdateObjectAttributesUnsupportedOnly(t *testing.T) {
	driver := newStubObjectDriver()
	driver.metadataErr = providers.ErrUnsupportedCapability
	driver.tagsErr = providers.ErrUnsupportedCapability
	driver.aclErr = providers.ErrUnsupportedCapability
	driver.headResponses[driver.key("docs", "file.txt")] = headResponse{
		desc: providers.ObjectDescriptor{Key: "file.txt"},
		err:  nil,
	}
	svc, accountID := newTestObjectsService(t, driver)
	patch := ObjectAttributesPatch{
		Bucket:   "docs",
		Key:      "file.txt",
		Metadata: map[string]string{"owner": "dev"},
	}
	if _, err := svc.UpdateObjectAttributes(context.Background(), accountID, patch); err == nil {
		t.Fatalf("expected unsupported error")
	}
}

func TestUpdateObjectAttributesPartialSuccess(t *testing.T) {
	driver := newStubObjectDriver()
	driver.metadataErr = providers.ErrUnsupportedCapability
	driver.headResponses[driver.key("docs", "file.txt")] = headResponse{
		desc: providers.ObjectDescriptor{Key: "file.txt"},
		err:  nil,
	}
	svc, accountID := newTestObjectsService(t, driver)
	patch := ObjectAttributesPatch{
		Bucket:   "docs",
		Key:      "file.txt",
		Metadata: map[string]string{"owner": "dev"},
		Tags:     map[string]string{"env": "test"},
	}
	if _, err := svc.UpdateObjectAttributes(context.Background(), accountID, patch); err != nil {
		t.Fatalf("expected partial success, got %v", err)
	}
}

type stubObjectDriver struct {
	headResponses map[string]headResponse
	copyCalls     []copyCall
	deleteCalls   []deleteCall
	copyErr       error
	deleteErr     error
	metadataErr   error
	tagsErr       error
	aclErr        error
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

func (s *stubObjectDriver) DownloadObject(context.Context, providers.DownloadObjectInput) (providers.ObjectDownload, error) {
	return providers.ObjectDownload{}, nil
}

func (s *stubObjectDriver) PresignURL(_ context.Context, req providers.PresignRequest) (string, error) {
	method := strings.ToLower(strings.TrimSpace(req.Method))
	if method == "" {
		method = "get"
	}
	return fmt.Sprintf("https://example.com/%s/%s", method, req.Key), nil
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

func TestGenerateAccessLinksStoresHistory(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)
	ctx := context.Background()
	links, err := svc.GenerateAccessLinks(ctx, accountID, AccessLinkRequest{
		Bucket:            "docs",
		Key:               "report.pdf",
		Methods:           []string{"GET", "HEAD"},
		ExpirationSeconds: 120,
		FileName:          "report.pdf",
	})
	if err != nil {
		t.Fatalf("generate links: %v", err)
	}
	if len(links) != 2 {
		t.Fatalf("expected 2 links, got %d", len(links))
	}
	for _, link := range links {
		if !strings.HasPrefix(link.QRCode, "data:image/png;base64,") {
			t.Fatalf("link %s missing qr data", link.Method)
		}
		if link.Markdown == "" || link.HTML == "" {
			t.Fatalf("link %s missing representations", link.Method)
		}
	}
	history, err := svc.ListAccessLinkHistory(ctx, accountID, 10)
	if err != nil {
		t.Fatalf("list history: %v", err)
	}
	if len(history) != 2 {
		t.Fatalf("expected 2 history entries, got %d", len(history))
	}
	if err := svc.DeleteAccessLinkHistory(ctx, accountID, history[0].ID); err != nil {
		t.Fatalf("delete history: %v", err)
	}
}

func (s *stubObjectDriver) GetObjectTags(context.Context, string, string) (map[string]string, error) {
	return nil, nil
}

func (s *stubObjectDriver) PutObjectTags(context.Context, string, string, map[string]string) error {
	if s.tagsErr != nil {
		return s.tagsErr
	}
	return nil
}

func (s *stubObjectDriver) UpdateObjectMetadata(context.Context, string, string, providers.ObjectMetadataUpdate) error {
	if s.metadataErr != nil {
		return s.metadataErr
	}
	return nil
}

func (s *stubObjectDriver) GetObjectACL(context.Context, string, string) (providers.ObjectACL, error) {
	if s.aclErr != nil {
		return providers.ObjectACL{}, s.aclErr
	}
	return providers.ObjectACL{}, providers.ErrUnsupportedCapability
}

func (s *stubObjectDriver) PutObjectACL(context.Context, string, string, string) error {
	if s.aclErr != nil {
		return s.aclErr
	}
	return providers.ErrUnsupportedCapability
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
	pool := providers.NewClientPool(factory)
	accountSvc.SetClientPool(pool)
	service := NewService(accountSvc, pool, nil, NewMemoryLinkHistoryStore())
	return service, account.ID
}
