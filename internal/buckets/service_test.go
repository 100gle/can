package buckets

import (
	"context"
	"testing"
	"time"

	"can/internal/accounts"
	"can/internal/storage"
	"can/internal/types"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestListBucketsSortsAlphabetically(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketAPI{
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
	driver := &fakeBucketAPI{
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
	driver := &fakeBucketAPI{}
	svc, accountID := newTestBucketService(t, driver)

	// Normal valid input
	err := svc.CreateBucket(ctx, accountID, storage.BucketCreateInput{
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
	driver := &fakeBucketAPI{}
	svc, accountID := newTestBucketService(t, driver)

	err := svc.CreateBucket(ctx, accountID, storage.BucketCreateInput{Name: "my-bucket"})
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
	driver := &fakeBucketAPI{}
	svc, accountID := newTestBucketService(t, driver)

	input := storage.BucketCreateInput{
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

func TestClientRequiresAccountID(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketAPI{}
	svc, _ := newTestBucketService(t, driver)

	_, err := svc.ListBuckets(ctx, "")
	if err == nil {
		t.Fatal("expected error for empty account ID")
	}
}

// --- Test Fixtures ---

func newTestBucketService(t *testing.T, driver *fakeBucketAPI) (*Service, string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open memory db: %v", err)
	}
	store, err := accounts.NewSQLiteStore(db)
	if err != nil {
		t.Fatalf("failed to create sqlite store: %v", err)
	}
	accountSvc := accounts.NewService(store)

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

	builder := func(ctx context.Context, rec storage.ClientRecord) (*storage.Client, error) {
		return &storage.Client{
			ID:       rec.ID,
			Provider: rec.Provider,
			Region:   rec.Region,
			Bucket:   driver,
		}, nil
	}
	vault := storage.NewClientVault(db, builder)
	svc := NewService(accountSvc, vault)
	return svc, account.ID
}

type fakeBucketAPI struct {
	buckets             []storage.BucketDescriptor
	createdName         string
	createdRegion       string
	createdStorageClass string
	createdMultiAZ      bool
	deletedName         string
	headedName          string
	locationName        string
}

func (d *fakeBucketAPI) ListBuckets(ctx context.Context) ([]storage.BucketDescriptor, error) {
	return d.buckets, nil
}

func (d *fakeBucketAPI) CreateBucket(ctx context.Context, input storage.BucketCreateInput) error {
	d.createdName = input.Name
	d.createdRegion = input.Region
	d.createdStorageClass = input.StorageClass
	d.createdMultiAZ = input.COSMultiAZ
	return nil
}

func (d *fakeBucketAPI) DeleteBucket(ctx context.Context, name string) error {
	d.deletedName = name
	return nil
}

func (d *fakeBucketAPI) HeadBucket(ctx context.Context, name string) error {
	d.headedName = name
	return nil
}

func (d *fakeBucketAPI) BucketLocation(ctx context.Context, name string) (string, error) {
	d.locationName = name
	return "us-east-1", nil
}

func (d *fakeBucketAPI) GetBucketACL(ctx context.Context, name string) (storage.BucketACL, error) {
	return storage.BucketACL{}, nil
}

func (d *fakeBucketAPI) PutBucketACL(ctx context.Context, name string, acl storage.BucketACLInput) error {
	return nil
}

func (d *fakeBucketAPI) GetPublicAccessBlock(ctx context.Context, name string) (storage.PublicAccessBlock, error) {
	return storage.PublicAccessBlock{}, nil
}

func (d *fakeBucketAPI) PutPublicAccessBlock(ctx context.Context, name string, block storage.PublicAccessBlock) error {
	return nil
}

func (d *fakeBucketAPI) GetBucketReferer(ctx context.Context, name string) (storage.BucketReferer, error) {
	return storage.BucketReferer{}, nil
}

func (d *fakeBucketAPI) PutBucketReferer(ctx context.Context, name string, referer storage.BucketReferer) error {
	return nil
}

// Missing methods implementation
func (d *fakeBucketAPI) GetBucketEncryption(ctx context.Context, bucket string) (*storage.BucketEncryptionConfiguration, error) {
	return nil, nil
}
func (d *fakeBucketAPI) PutBucketEncryption(ctx context.Context, bucket string, config storage.BucketEncryptionConfiguration) error {
	return nil
}
func (d *fakeBucketAPI) DeleteBucketEncryption(ctx context.Context, bucket string) error {
	return nil
}
func (d *fakeBucketAPI) GetBucketPolicy(ctx context.Context, bucket string) (string, error) {
	return "", nil
}
func (d *fakeBucketAPI) PutBucketPolicy(ctx context.Context, bucket, policy string) error {
	return nil
}
func (d *fakeBucketAPI) DeleteBucketPolicy(ctx context.Context, bucket string) error { return nil }
func (d *fakeBucketAPI) GetBucketVersioning(ctx context.Context, bucket string) (storage.BucketVersioningStatus, error) {
	return "", nil
}
func (d *fakeBucketAPI) PutBucketVersioning(ctx context.Context, bucket string, status storage.BucketVersioningStatus) error {
	return nil
}
func (d *fakeBucketAPI) GetBucketLifecycleConfiguration(ctx context.Context, bucket string) ([]storage.LifecycleRule, error) {
	return nil, nil
}
func (d *fakeBucketAPI) PutBucketLifecycleConfiguration(ctx context.Context, bucket string, rules []storage.LifecycleRule) error {
	return nil
}
func (d *fakeBucketAPI) DeleteBucketLifecycle(ctx context.Context, bucket string) error {
	return nil
}
func (d *fakeBucketAPI) GetBucketCors(ctx context.Context, bucket string) ([]storage.CORSRule, error) {
	return nil, nil
}
func (d *fakeBucketAPI) PutBucketCors(ctx context.Context, bucket string, rules []storage.CORSRule) error {
	return nil
}
func (d *fakeBucketAPI) DeleteBucketCors(ctx context.Context, bucket string) error { return nil }
func (d *fakeBucketAPI) GetBucketWebsite(ctx context.Context, bucket string) (*storage.BucketWebsiteConfiguration, error) {
	return nil, nil
}
func (d *fakeBucketAPI) PutBucketWebsite(ctx context.Context, bucket string, config storage.BucketWebsiteConfiguration) error {
	return nil
}
func (d *fakeBucketAPI) DeleteBucketWebsite(ctx context.Context, bucket string) error { return nil }
func (d *fakeBucketAPI) GetBucketMAZConfig(ctx context.Context, name string) (*storage.MAZConfiguration, error) {
	return &storage.MAZConfiguration{Status: storage.MAZStatusDisabled}, nil
}
func (d *fakeBucketAPI) EnableBucketMAZ(ctx context.Context, name string) error  { return nil }
func (d *fakeBucketAPI) DisableBucketMAZ(ctx context.Context, name string) error { return nil }

var _ storage.BucketAdapter = (*fakeBucketAPI)(nil)
var _ = time.Now // Suppress unused import if time not used
