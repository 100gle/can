package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"can/internal/accounts"
	"can/internal/buckets"
	"can/internal/objects"
	"can/internal/providers"
	"can/internal/security"
	"can/internal/types"
)

// App struct
type App struct {
	ctx      context.Context
	accounts *accounts.Service
	buckets  *buckets.Service
	objects  *objects.Service
}

// NewApp creates a new App application struct
func NewApp() *App {
	store := initStoreFromEnv()
	cipher := security.DefaultCipher()
	s3Factory := providers.NewS3ClientFactory()
	storageFactory := providers.NewStorageFactory(s3Factory)
	dialer := providers.NewS3Dialer(providers.WithS3ClientFactory(s3Factory))
	sessionStore := initSessionStore()
	accountSvc := accounts.NewService(store, cipher, dialer, sessionStore)
	bucketSvc := buckets.NewService(accountSvc, storageFactory)
	objectSvc := objects.NewService(accountSvc, storageFactory)
	return &App{accounts: accountSvc, buckets: bucketSvc, objects: objectSvc}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if err := a.accounts.EnsureSeed(ctx); err != nil {
		runtime.LogErrorf(ctx, "seed sample accounts: %v", err)
	}
}

// SupportedProviders exposes the providers metadata to the UI.
func (a *App) SupportedProviders() []types.ProviderMetadata {
	return types.KnownProviders()
}

// ProviderCapabilities exposes capability matrix to the UI.
func (a *App) ProviderCapabilities() []types.ProviderCapability {
	return types.CapabilityMatrix()
}

// ListAccounts returns all configured accounts.
func (a *App) ListAccounts() ([]accounts.Account, error) {
	return a.accounts.ListAccounts(a.ctx)
}

// CreateAccount registers a new account configuration.
func (a *App) CreateAccount(input accounts.CreateAccountInput) (accounts.Account, error) {
	return a.accounts.CreateAccount(a.ctx, input)
}

// UpdateAccount updates an existing account configuration.
func (a *App) UpdateAccount(id string, input accounts.UpdateAccountInput) (accounts.Account, error) {
	return a.accounts.UpdateAccount(a.ctx, id, input)
}

// DeleteAccount removes the account with the given ID.
func (a *App) DeleteAccount(id string) error {
	return a.accounts.DeleteAccount(a.ctx, id)
}

// SetActiveAccount marks an account as active for the current session.
func (a *App) SetActiveAccount(id string) (accounts.Account, error) {
	return a.accounts.SetActiveAccount(a.ctx, id)
}

// ActiveAccount returns the current active account if set.
func (a *App) ActiveAccount() (*accounts.Account, error) {
	return a.accounts.ActiveAccount(a.ctx)
}

// TestAccountConnection validates the credentials for an account.
func (a *App) TestAccountConnection(id string) (accounts.ConnectionTestResult, error) {
	return a.accounts.TestConnection(a.ctx, id)
}

// ListBuckets returns all buckets for the given account.
func (a *App) ListBuckets(accountID string) ([]buckets.BucketInfo, error) {
	return a.buckets.ListBuckets(a.ctx, accountID)
}

// CreateBucket provisions a new bucket under the provided account.
func (a *App) CreateBucket(accountID, name, region string) error {
	return a.buckets.CreateBucket(a.ctx, accountID, name, region)
}

// DeleteBucket removes the selected bucket.
func (a *App) DeleteBucket(accountID, name string) error {
	return a.buckets.DeleteBucket(a.ctx, accountID, name)
}

// BucketLocation resolves the region for a bucket.
func (a *App) BucketLocation(accountID, name string) (string, error) {
	return a.buckets.BucketLocation(a.ctx, accountID, name)
}

// HeadBucket checks whether a bucket exists.
func (a *App) HeadBucket(accountID, name string) error {
	return a.buckets.HeadBucket(a.ctx, accountID, name)
}

// ListObjects enumerates objects under the given prefix.
func (a *App) ListObjects(accountID string, input objects.ListObjectsInput) (objects.ListObjectsResult, error) {
	return a.objects.ListObjects(a.ctx, accountID, input)
}

// UploadObject uploads a local file to the target bucket.
func (a *App) UploadObject(accountID, bucket, key, filePath string) error {
	return a.objects.UploadObject(a.ctx, accountID, bucket, key, filePath)
}

// DownloadObject downloads an object to the provided path.
func (a *App) DownloadObject(accountID, bucket, key, savePath string) error {
	return a.objects.DownloadObject(a.ctx, accountID, bucket, key, savePath)
}

// DeleteObject removes an object from the bucket.
func (a *App) DeleteObject(accountID, bucket, key string) error {
	return a.objects.DeleteObject(a.ctx, accountID, bucket, key)
}

// CopyObject duplicates an object to a new location.
func (a *App) CopyObject(accountID, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	return a.objects.CopyObject(a.ctx, accountID, sourceBucket, sourceKey, targetBucket, targetKey)
}

// HeadObject fetches metadata for a specific key.
func (a *App) HeadObject(accountID, bucket, key string) (objects.ObjectInfo, error) {
	return a.objects.HeadObject(a.ctx, accountID, bucket, key)
}

// ExportAccounts writes all stored account configs into an encrypted bundle via SaveFileDialog.
func (a *App) ExportAccounts() (accounts.ExportSummary, error) {
	var summary accounts.ExportSummary
	if a.ctx == nil {
		return summary, errors.New("application context not ready")
	}
	payload, err := a.accounts.ExportData(a.ctx)
	if err != nil {
		return summary, err
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "导出账户配置",
		DefaultFilename: fmt.Sprintf("can-accounts-%s.canx", time.Now().Format("20060102-150405")),
		Filters: []runtime.FileFilter{
			{DisplayName: "CAN Account Bundle (*.canx)", Pattern: "*.canx"},
		},
	})
	if err != nil {
		return summary, err
	}
	if path == "" {
		summary.Cancelled = true
		return summary, nil
	}
	if filepath.Ext(path) == "" {
		path += ".canx"
	}
	if err := os.WriteFile(path, payload.Blob, 0o600); err != nil {
		return summary, err
	}
	summary.FilePath = path
	summary.Count = payload.Count
	summary.Cipher = payload.Cipher
	summary.Version = payload.Version
	return summary, nil
}

// ImportAccounts loads account configs from an encrypted bundle selected via OpenFileDialog.
func (a *App) ImportAccounts() (accounts.ImportSummary, error) {
	var summary accounts.ImportSummary
	if a.ctx == nil {
		return summary, errors.New("application context not ready")
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "导入账户配置",
		Filters: []runtime.FileFilter{
			{DisplayName: "CAN Account Bundle (*.canx)", Pattern: "*.canx"},
		},
	})
	if err != nil {
		return summary, err
	}
	if path == "" {
		summary.Cancelled = true
		return summary, nil
	}
	blob, err := os.ReadFile(path)
	if err != nil {
		return summary, err
	}
	result, err := a.accounts.ImportData(a.ctx, blob)
	if err != nil {
		return summary, err
	}
	summary.FilePath = path
	summary.Total = result.Total
	summary.Imported = result.Imported
	summary.Skipped = result.Skipped
	summary.Failed = result.Failed
	summary.Issues = result.Issues
	return summary, nil
}

func initStoreFromEnv() accounts.Store {
	driver := strings.TrimSpace(os.Getenv("CAN_DB_DRIVER"))
	if driver == "" {
		driver = "sqlite"
	}
	switch strings.ToLower(driver) {
	case "memory":
		return accounts.NewMemoryStore()
	case "sqlite":
		dsn := strings.TrimSpace(os.Getenv("CAN_DB_DSN"))
		if dsn == "" {
			path, err := defaultSQLitePath()
			if err != nil {
				fmt.Printf("failed to resolve default sqlite path, fallback to memory: %v\n", err)
				break
			}
			dsn = path
		}
		store, err := accounts.NewSQLiteStore(dsn)
		if err != nil {
			fmt.Printf("failed to init sqlite store (%s): %v\n", dsn, err)
			break
		}
		return store
	default:
		fmt.Printf("unknown CAN_DB_DRIVER %q, fallback to sqlite\n", driver)
		os.Setenv("CAN_DB_DRIVER", "sqlite")
		return initStoreFromEnv()
	}
	return accounts.NewMemoryStore()
}

func defaultSQLitePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = filepath.Join(os.TempDir(), "can")
	} else {
		dir = filepath.Join(dir, "can")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "accounts.db"), nil
}

func initSessionStore() accounts.ActiveSessionStore {
	path := strings.TrimSpace(os.Getenv("CAN_SESSION_PATH"))
	if path == "" {
		dir, err := os.UserConfigDir()
		if err != nil || dir == "" {
			dir = filepath.Join(os.TempDir(), "can")
		} else {
			dir = filepath.Join(dir, "can")
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			fmt.Printf("failed to prepare session directory, using memory store: %v\n", err)
			return accounts.NewMemorySessionStore()
		}
		path = filepath.Join(dir, "session.json")
	}
	store, err := accounts.NewFileSessionStore(path)
	if err != nil {
		fmt.Printf("failed to create session store (%s), using memory store: %v\n", path, err)
		return accounts.NewMemorySessionStore()
	}
	return store
}

// Greet returns a greeting for the given name (legacy sample kept for smoke tests).
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
