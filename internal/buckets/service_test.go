package buckets

import (
	"context"
	"errors"
	"testing"
	"time"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/security"
	"can/internal/types"
)

func TestListBucketsSortsAlphabetically(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{
		buckets: []providers.BucketDescriptor{
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
		buckets: []providers.BucketDescriptor{
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

func TestCreateBucketRequiresName(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{}
	svc, accountID := newTestBucketService(t, driver)

	err := svc.CreateBucket(ctx, accountID, "", "us-east-1")
	if err == nil {
		t.Fatal("expected error for empty bucket name")
	}
	if err.Error() != "bucket name is required" {
		t.Errorf("unexpected error message: %v", err)
	}
}

func TestCreateBucketUsesDefaultRegion(t *testing.T) {
	ctx := context.Background()
	driver := &fakeBucketDriver{}
	svc, accountID := newTestBucketService(t, driver)

	err := svc.CreateBucket(ctx, accountID, "my-bucket", "")
	if err != nil {
		t.Fatalf("CreateBucket: %v", err)
	}
	// Verify the driver received the default region from credentials
	if driver.createdRegion != "us-east-1" {
		t.Errorf("expected region 'us-east-1', got %q", driver.createdRegion)
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

	factory := &fakeStorageFactory{client: &fakeStorageClient{buckets: driver}}
	pool := providers.NewClientPool(factory)
	accountSvc.SetClientPool(pool)

	svc := NewService(accountSvc, pool)
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
	buckets *fakeBucketDriver
}

func (f *fakeStorageClient) Provider() types.Provider {
	return types.ProviderAWS
}

func (f *fakeStorageClient) Capabilities() []types.ProviderCapability {
	return nil
}

func (f *fakeStorageClient) Buckets() providers.BucketDriver {
	return f.buckets
}

func (f *fakeStorageClient) Objects() providers.ObjectDriver {
	return nil
}

func (f *fakeStorageClient) Security() providers.SecurityDriver {
	return nil
}

type fakeBucketDriver struct {
	buckets       []providers.BucketDescriptor
	createdName   string
	createdRegion string
	deletedName   string
	headedName    string
	locationName  string
}

func (d *fakeBucketDriver) ListBuckets(ctx context.Context) ([]providers.BucketDescriptor, error) {
	return d.buckets, nil
}

func (d *fakeBucketDriver) CreateBucket(ctx context.Context, name, region string) error {
	d.createdName = name
	d.createdRegion = region
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

func (d *fakeBucketDriver) GetBucketACL(ctx context.Context, name string) (providers.BucketACL, error) {
	return providers.BucketACL{}, nil
}

func (d *fakeBucketDriver) PutBucketACL(ctx context.Context, name string, acl providers.BucketACLInput) error {
	return nil
}

func (d *fakeBucketDriver) GetPublicAccessBlock(ctx context.Context, name string) (providers.PublicAccessBlock, error) {
	return providers.PublicAccessBlock{}, nil
}

func (d *fakeBucketDriver) PutPublicAccessBlock(ctx context.Context, name string, block providers.PublicAccessBlock) error {
	return nil
}

func (d *fakeBucketDriver) GetBucketReferer(ctx context.Context, name string) (providers.BucketReferer, error) {
	return providers.BucketReferer{}, nil
}

func (d *fakeBucketDriver) PutBucketReferer(ctx context.Context, name string, referer providers.BucketReferer) error {
	return nil
}

var _ providers.BucketDriver = (*fakeBucketDriver)(nil)
var _ providers.StorageClient = (*fakeStorageClient)(nil)
var _ providers.StorageFactory = (*fakeStorageFactory)(nil)
var _ = time.Now // Suppress unused import if time not used
