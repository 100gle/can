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

func TestDeleteObjectWithRequestIDSkipsDuplicates(t *testing.T) {
	driver := newStubObjectDriver()
	store := &memoryAuditStore{}
	auditSvc := security.NewService(store)
	svc, accountID := newTestObjectsService(t, driver, auditSvc)
	ctx := context.Background()
	opts := WithMutationOptions(MutationOptions{
		RequestID: "req-123",
		Origin:    "offline-queue",
	})
	if err := svc.DeleteObject(ctx, accountID, "docs", "file.txt", opts); err != nil {
		t.Fatalf("first delete failed: %v", err)
	}
	if err := svc.DeleteObject(ctx, accountID, "docs", "file.txt", opts); err != nil {
		t.Fatalf("duplicate delete should be skipped, got error: %v", err)
	}
	if len(driver.deleteCalls) != 1 {
		t.Fatalf("expected exactly one delete call, got %d", len(driver.deleteCalls))
	}
	if processed, _ := store.HasRequest(ctx, "req-123"); !processed {
		t.Fatalf("expected request id to be recorded")
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

func TestCopyObjectSucceeds(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)
	ctx := context.Background()
	if err := svc.CopyObject(ctx, accountID, "src", "file.txt", "dst", "copied.txt"); err != nil {
		t.Fatalf("copy object: %v", err)
	}
	if len(driver.copyCalls) != 1 {
		t.Fatalf("expected 1 copy call, got %d", len(driver.copyCalls))
	}
	call := driver.copyCalls[0]
	if call.sourceBucket != "src" || call.sourceKey != "file.txt" || call.targetBucket != "dst" || call.targetKey != "copied.txt" {
		t.Fatalf("unexpected copy call: %+v", call)
	}
}

func TestCopyObjectPropagatesError(t *testing.T) {
	driver := newStubObjectDriver()
	driver.copyErr = errors.New("copy failed")
	svc, accountID := newTestObjectsService(t, driver)
	err := svc.CopyObject(context.Background(), accountID, "src", "file.txt", "dst", "copied.txt")
	if !errors.Is(err, driver.copyErr) {
		t.Fatalf("expected copy error, got %v", err)
	}
}

func TestGetObjectAttributesReturnsMetadata(t *testing.T) {
	driver := newStubObjectDriver()
	driver.headResponses[driver.key("docs", "report.pdf")] = headResponse{
		desc: providers.ObjectDescriptor{
			Key:          "report.pdf",
			Size:         1024,
			ContentType:  "application/pdf",
			StorageClass: "STANDARD",
		},
		err: nil,
	}
	svc, accountID := newTestObjectsService(t, driver)
	ctx := context.Background()
	attrs, err := svc.GetObjectAttributes(ctx, accountID, "docs", "report.pdf")
	if err != nil {
		t.Fatalf("get object attributes: %v", err)
	}
	if attrs.Object.Key != "report.pdf" {
		t.Fatalf("expected key report.pdf, got %s", attrs.Object.Key)
	}
	if attrs.Object.Size != 1024 {
		t.Fatalf("expected size 1024, got %d", attrs.Object.Size)
	}
}

func TestGetObjectAttributesNotFound(t *testing.T) {
	driver := newStubObjectDriver()
	driver.headResponses[driver.key("docs", "missing.txt")] = headResponse{
		err: errors.New("object not found"),
	}
	svc, accountID := newTestObjectsService(t, driver)
	_, err := svc.GetObjectAttributes(context.Background(), accountID, "docs", "missing.txt")
	if err == nil {
		t.Fatalf("expected error for missing object")
	}
}

func TestBatchUpdateObjectAttributesPartialFailure(t *testing.T) {
	driver := newStubObjectDriver()
	driver.headResponses[driver.key("docs", "a.txt")] = headResponse{
		desc: providers.ObjectDescriptor{Key: "a.txt"},
	}
	driver.headResponses[driver.key("docs", "b.txt")] = headResponse{
		desc: providers.ObjectDescriptor{Key: "b.txt"},
	}
	// First object will fail tags update
	driver.tagsErr = errors.New("tags update failed")
	svc, accountID := newTestObjectsService(t, driver)
	patches := []ObjectAttributesPatch{
		{Bucket: "docs", Key: "a.txt", Tags: map[string]string{"env": "prod"}},
		{Bucket: "docs", Key: "b.txt", Tags: map[string]string{"env": "dev"}},
	}
	result, err := svc.BatchUpdateObjectAttributes(context.Background(), accountID, patches)
	if err != nil {
		t.Fatalf("batch update: %v", err)
	}
	if result.Total != 2 {
		t.Fatalf("expected total 2, got %d", result.Total)
	}
	// Both should fail since driver.tagsErr is set
	if len(result.Failed) != 2 {
		t.Fatalf("expected 2 failures, got %d", len(result.Failed))
	}
}

func TestBatchDeleteObjects(t *testing.T) {
	driver := newStubObjectDriver()
	svc, accountID := newTestObjectsService(t, driver)
	keys := []string{"a.txt", "b.txt"}
	result, err := svc.BatchDeleteObjects(context.Background(), accountID, "docs", keys)
	if err != nil {
		t.Fatalf("batch delete: %v", err)
	}
	if result.Total != 2 {
		t.Fatalf("expected total 2, got %d", result.Total)
	}
	if result.Succeeded != 2 {
		t.Fatalf("expected 2 successes, got %d", result.Succeeded)
	}
	if len(driver.deleteCalls) != 2 {
		t.Fatalf("expected 2 delete calls, got %d", len(driver.deleteCalls))
	}
}

func TestBatchDeleteObjectsPartialFailure(t *testing.T) {
	driver := newStubObjectDriver()
	// Fail delete for b.txt specifically if we could control per-key,
	// but stub driver errors globally. Let's make it check Key.
	// We'll modify stub delete to fail for "fail.txt"
	svc, accountID := newTestObjectsService(t, driver)
	driver.deleteErrMap = map[string]error{"fail.txt": errors.New("delete failed")}

	keys := []string{"ok.txt", "fail.txt"}
	result, err := svc.BatchDeleteObjects(context.Background(), accountID, "docs", keys)
	if err != nil {
		t.Fatalf("batch delete should not return error on partial failure: %v", err)
	}
	if result.Succeeded != 1 {
		t.Fatalf("expected 1 success, got %d", result.Succeeded)
	}
	if len(result.Failed) != 1 {
		t.Fatalf("expected 1 failure, got %d", len(result.Failed))
	}
	if result.Failed[0].Key != "fail.txt" {
		t.Fatalf("expected failure for fail.txt, got %s", result.Failed[0].Key)
	}
}

type stubObjectDriver struct {
	headResponses map[string]headResponse
	copyCalls     []copyCall
	deleteCalls   []deleteCall
	copyErr       error
	deleteErr     error
	deleteErrMap  map[string]error
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

type memoryAuditStore struct {
	events []security.AuditEvent
}

func (m *memoryAuditStore) Record(_ context.Context, event security.AuditEvent) error {
	m.events = append(m.events, event)
	return nil
}

func (m *memoryAuditStore) Query(context.Context, security.AuditFilter) ([]security.AuditEvent, error) {
	copied := make([]security.AuditEvent, len(m.events))
	copy(copied, m.events)
	return copied, nil
}

func (m *memoryAuditStore) Init() error {
	return nil
}

func (m *memoryAuditStore) HasRequest(_ context.Context, requestID string) (bool, error) {
	id := strings.TrimSpace(requestID)
	if id == "" {
		return false, nil
	}
	for _, event := range m.events {
		if event.RequestID == id && strings.EqualFold(event.Status, "Success") {
			return true, nil
		}
	}
	return false, nil
}

func newStubObjectDriver() *stubObjectDriver {
	return &stubObjectDriver{
		headResponses: make(map[string]headResponse),
		deleteErrMap:  make(map[string]error),
	}
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
	if err, ok := s.deleteErrMap[key]; ok {
		return err
	}
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

func (s *stubObjectDriver) CreateSymlink(context.Context, string, string, string) error {
	return nil
}

func (s *stubObjectDriver) HeadObject(_ context.Context, bucket, key string) (providers.ObjectDescriptor, error) {
	resp, ok := s.headResponses[s.key(bucket, key)]
	if !ok {
		return providers.ObjectDescriptor{}, errors.New("head response not configured")
	}
	return resp.desc, resp.err
}

func (s *stubObjectDriver) GetObjectLockConfiguration(context.Context, string) (providers.ObjectLockConfiguration, error) {
	return providers.ObjectLockConfiguration{}, nil
}

func (s *stubObjectDriver) GetObjectRetention(context.Context, string, string, string) (providers.ObjectRetentionState, error) {
	return providers.ObjectRetentionState{}, nil
}

func (s *stubObjectDriver) PutObjectRetention(context.Context, providers.PutObjectRetentionInput) error {
	return nil
}

func (s *stubObjectDriver) GetObjectLegalHold(context.Context, string, string, string) (providers.ObjectLegalHoldState, error) {
	return providers.ObjectLegalHoldState{}, nil
}

func (s *stubObjectDriver) PutObjectLegalHold(context.Context, providers.PutObjectLegalHoldInput) error {
	return nil
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

func (s *stubStorageClient) Security() providers.SecurityDriver {
	return nil
}

func newTestObjectsService(t *testing.T, driver providers.ObjectDriver, audits ...*security.Service) (*Service, string) {
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
	var audit *security.Service
	if len(audits) > 0 {
		audit = audits[0]
	}
	service := NewService(accountSvc, pool, nil, NewMemoryLinkHistoryStore(), audit)
	return service, account.ID
}
