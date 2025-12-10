package buckets

import (
	"context"
	"errors"
	"testing"
	"time"

	"can/internal/accounts"
	"can/internal/storage"

	"can/internal/types"
)

func TestListBucketsSortsAlphabetically(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{
		buckets: []storage.BucketDescriptor{
			{Name: "zebra", Region: "us-east-1"},
			{Name: "alpha", Region: "us-west-2"},
			{Name: "mango", Region: ""},
		},
	}
	svc, accountID := newTestBucketService(t, driver)

	result, err := svc.ListBuckets(ctx, accountID)
	if err != nil {
		t.Fatalf("ListBuckets: %v", err)
	}
	if len(result) != 3 {
		t.Fatalf("expected 3 buckets, got %d", len(result))
	}
	// Verify sorted order
	if result[0].Name != "alpha" || result[1].Name != "mango" || result[2].Name != "zebra" {
		t.Errorf("buckets not sorted, got %v", []string{result[0].Name, result[1].Name, result[2].Name})
	}
}

func TestListBucketsBackfillsEmptyRegion(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{
		buckets: []storage.BucketDescriptor{
			{Name: "no-region", Region: ""},
		},
	}
	svc, accountID := newTestBucketService(t, driver)

	result, err := svc.ListBuckets(ctx, accountID)
	if err != nil {
		t.Fatalf("ListBuckets: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 bucket, got %d", len(result))
	}
	// Region should be backfilled from account credentials (us-east-1)
	if result[0].Region != "us-east-1" {
		t.Errorf("expected region backfill to 'us-east-1', got %q", result[0].Region)
	}
}

// TestCreateBucketPassesToDriver verifies that CreateBucket correctly forwards
// valid input to the storage driver. Input validation is the responsibility of
// the app layer (Controller), not the Service layer per Sprint 14 architecture.
func TestCreateBucketPassesToDriver(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{}
	svc, accountID := newTestBucketService(t, driver)

	// Normal valid input
	err := svc.CreateBucket(ctx, accountID, CreateBucketInput{
		Name:   "valid-bucket",
		Region: "us-east-1",
	})
	if err != nil {
		t.Fatalf("CreateBucket failed unexpectedly: %v", err)
	}
	if driver.createdName != "valid-bucket" {
		t.Errorf("expected driver to receive 'valid-bucket', got %q", driver.createdName)
	}
}

func TestCreateBucketUsesDefaultRegion(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{}
	svc, accountID := newTestBucketService(t, driver)

	err := svc.CreateBucket(ctx, accountID, CreateBucketInput{Name: "my-bucket"})
	if err != nil {
		t.Fatalf("CreateBucket: %v", err)
	}
	// Verify the driver received the default region from credentials
	if driver.createdRegion != "us-east-1" {
		t.Errorf("expected region 'us-east-1', got %q", driver.createdRegion)
	}
}

func TestCreateBucketPassesAdvancedOptions(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{}
	svc, accountID := newTestBucketService(t, driver)

	input := CreateBucketInput{
		Name:         "oss-demo",
		Region:       "cn-hangzhou",
		ACL:          "public-read",
		StorageClass: "ia",
		COSMultiAZ:   true,
	}
	if err := svc.CreateBucket(ctx, accountID, input); err != nil {
		t.Fatalf("CreateBucket: %v", err)
	}
	if driver.createdStorageClass != "ia" {
		t.Errorf("expected storage class 'ia', got %q", driver.createdStorageClass)
	}
	if !driver.createdMultiAZ {
		t.Errorf("expected multi AZ flag to be forwarded")
	}
}

func TestDeleteBucketRequiresName(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{}
	svc, accountID := newTestBucketService(t, driver)

	err := svc.DeleteBucket(ctx, accountID, "   ")
	if err == nil {
		t.Fatal("expected error for empty bucket name")
	}
}

func TestClientRequiresAccountID(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{}
	svc, _ := newTestBucketService(t, driver)

	_, err := svc.ListBuckets(ctx, "")
	if err == nil {
		t.Fatal("expected error for empty account ID")
	}
}

// --- Test Fixtures ---

func newTestBucketService(t *testing.T, driver *fakeBucketDriver) (*Service, string) {
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

	factory := &fakeStorageFactory{client: &fakeStorageClient{buckets: driver}}
	pool := storage.NewClientPool(factory)
	accountSvc.SetClientPool(pool)

	svc := NewService(accountSvc, pool)
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
	buckets *fakeBucketDriver
}

func (f *fakeStorageClient) Provider() types.Provider {
	return types.ProviderAWS
}

func (f *fakeStorageClient) Capabilities() []types.ProviderCapability {
	return nil
}

func (f *fakeStorageClient) Buckets() storage.BucketDriver {
	return f.buckets
}

func (f *fakeStorageClient) Objects() storage.ObjectDriver {
	return nil
}

func (f *fakeStorageClient) Security() storage.SecurityDriver {
	return nil
}

type fakeBucketDriver struct {
	buckets             []storage.BucketDescriptor
	createdName         string
	createdRegion       string
	createdStorageClass string
	createdMultiAZ      bool
	deletedName         string
	headedName          string
	locationName        string
}

func (d *fakeBucketDriver) ListBuckets(ctx context.Context) ([]storage.BucketDescriptor, error) {
	return d.buckets, nil
}

func (d *fakeBucketDriver) CreateBucket(ctx context.Context, input storage.BucketCreateInput) error {
	d.createdName = input.Name
	d.createdRegion = input.Region
	d.createdStorageClass = input.StorageClass
	d.createdMultiAZ = input.COSMultiAZ
	return nil
}

func (d *fakeBucketDriver) DeleteBucket(ctx context.Context, name string) error {
	d.deletedName = name
	return nil
}

func (d *fakeBucketDriver) HeadBucket(ctx context.Context, name string) error {
	d.headedName = name
	return nil
}

func (d *fakeBucketDriver) BucketLocation(ctx context.Context, name string) (string, error) {
	d.locationName = name
	return "us-east-1", nil
}

func (d *fakeBucketDriver) GetBucketACL(ctx context.Context, name string) (storage.BucketACL, error) {
	return storage.BucketACL{}, nil
}

func (d *fakeBucketDriver) PutBucketACL(ctx context.Context, name string, acl storage.BucketACLInput) error {
	return nil
}

func (d *fakeBucketDriver) GetPublicAccessBlock(ctx context.Context, name string) (storage.PublicAccessBlock, error) {
	return storage.PublicAccessBlock{}, nil
}

func (d *fakeBucketDriver) PutPublicAccessBlock(ctx context.Context, name string, block storage.PublicAccessBlock) error {
	return nil
}

func (d *fakeBucketDriver) GetBucketReferer(ctx context.Context, name string) (storage.BucketReferer, error) {
	return storage.BucketReferer{}, nil
}

func (d *fakeBucketDriver) PutBucketReferer(ctx context.Context, name string, referer storage.BucketReferer) error {
	return nil
}

// Missing methods implementation
func (d *fakeBucketDriver) GetBucketEncryption(ctx context.Context, bucket string) (*storage.BucketEncryptionConfiguration, error) {
	return nil, nil
}
func (d *fakeBucketDriver) PutBucketEncryption(ctx context.Context, bucket string, config storage.BucketEncryptionConfiguration) error {
	return nil
}
func (d *fakeBucketDriver) DeleteBucketEncryption(ctx context.Context, bucket string) error {
	return nil
}
func (d *fakeBucketDriver) GetBucketPolicy(ctx context.Context, bucket string) (string, error) {
	return "", nil
}
func (d *fakeBucketDriver) PutBucketPolicy(ctx context.Context, bucket, policy string) error {
	return nil
}
func (d *fakeBucketDriver) DeleteBucketPolicy(ctx context.Context, bucket string) error { return nil }
func (d *fakeBucketDriver) GetBucketVersioning(ctx context.Context, bucket string) (storage.BucketVersioningStatus, error) {
	return "", nil
}
func (d *fakeBucketDriver) PutBucketVersioning(ctx context.Context, bucket string, status storage.BucketVersioningStatus) error {
	return nil
}
func (d *fakeBucketDriver) GetBucketLifecycleConfiguration(ctx context.Context, bucket string) ([]storage.LifecycleRule, error) {
	return nil, nil
}
func (d *fakeBucketDriver) PutBucketLifecycleConfiguration(ctx context.Context, bucket string, rules []storage.LifecycleRule) error {
	return nil
}
func (d *fakeBucketDriver) DeleteBucketLifecycle(ctx context.Context, bucket string) error {
	return nil
}
func (d *fakeBucketDriver) GetBucketCors(ctx context.Context, bucket string) ([]storage.CORSRule, error) {
	return nil, nil
}
func (d *fakeBucketDriver) PutBucketCors(ctx context.Context, bucket string, rules []storage.CORSRule) error {
	return nil
}
func (d *fakeBucketDriver) DeleteBucketCors(ctx context.Context, bucket string) error { return nil }
func (d *fakeBucketDriver) GetBucketWebsite(ctx context.Context, bucket string) (*storage.BucketWebsiteConfiguration, error) {
	return nil, nil
}
func (d *fakeBucketDriver) PutBucketWebsite(ctx context.Context, bucket string, config storage.BucketWebsiteConfiguration) error {
	return nil
}
func (d *fakeBucketDriver) DeleteBucketWebsite(ctx context.Context, bucket string) error { return nil }

var _ storage.BucketDriver = (*fakeBucketDriver)(nil)
var _ storage.StorageClient = (*fakeStorageClient)(nil)
var _ storage.StorageFactory = (*fakeStorageFactory)(nil)
var _ = time.Now // Suppress unused import if time not used
