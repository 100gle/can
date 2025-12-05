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
	"can/internal/config"
	"can/internal/objects"
	"can/internal/providers"
	"can/internal/search"
	"can/internal/security"
	"can/internal/transfer"
	"can/internal/types"
)

// App struct
type App struct {
	ctx       context.Context
	accounts  *accounts.Service
	buckets   *buckets.Service
	objects   *objects.Service
	transfers *transfer.Service
	config    *config.BucketConfigService
	search    *search.Service
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
	transferSvc := transfer.NewService(accountSvc, storageFactory)
	objectSvc := objects.NewService(accountSvc, storageFactory)
	configSvc := config.NewBucketConfigService(accountSvc, s3Factory)
	searchSvc := search.NewService(accountSvc, storageFactory)
	return &App{
		accounts: accountSvc,
		buckets:  bucketSvc,
		objects:  objectSvc,
		config:   configSvc,
		search:   searchSvc,
	}
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

// GetBucketVersioning returns versioning status for a bucket.
func (a *App) GetBucketVersioning(accountID, bucket string) (*config.BucketVersioning, error) {
	return a.config.GetVersioning(a.ctx, accountID, bucket)
}

// EnableBucketVersioning enables versioning for a bucket.
func (a *App) EnableBucketVersioning(accountID, bucket string) error {
	return a.config.EnableVersioning(a.ctx, accountID, bucket)
}

// SuspendBucketVersioning suspends versioning for a bucket.
func (a *App) SuspendBucketVersioning(accountID, bucket string) error {
	return a.config.SuspendVersioning(a.ctx, accountID, bucket)
}

// GetBucketEncryption fetches the default encryption configuration.
func (a *App) GetBucketEncryption(accountID, bucket string) (*config.BucketEncryption, error) {
	return a.config.GetEncryption(a.ctx, accountID, bucket)
}

// SetBucketEncryption updates default encryption configuration.
func (a *App) SetBucketEncryption(accountID, bucket string, encryption *config.BucketEncryption) error {
	return a.config.SetEncryption(a.ctx, accountID, bucket, encryption)
}

// DeleteBucketEncryption clears default encryption settings.
func (a *App) DeleteBucketEncryption(accountID, bucket string) error {
	return a.config.DeleteEncryption(a.ctx, accountID, bucket)
}

// GetBucketLifecycle lists lifecycle rules.
func (a *App) GetBucketLifecycle(accountID, bucket string) ([]*config.LifecycleRule, error) {
	return a.config.GetLifecycle(a.ctx, accountID, bucket)
}

// SetBucketLifecycle replaces lifecycle rules.
func (a *App) SetBucketLifecycle(accountID, bucket string, rules []*config.LifecycleRule) error {
	return a.config.SetLifecycle(a.ctx, accountID, bucket, rules)
}

// DeleteBucketLifecycle removes lifecycle rules.
func (a *App) DeleteBucketLifecycle(accountID, bucket string) error {
	return a.config.DeleteLifecycle(a.ctx, accountID, bucket)
}

// GetBucketCORS returns CORS rules.
func (a *App) GetBucketCORS(accountID, bucket string) (*config.BucketCORS, error) {
	return a.config.GetCORS(a.ctx, accountID, bucket)
}

// SetBucketCORS upserts CORS rules.
func (a *App) SetBucketCORS(accountID, bucket string, cors *config.BucketCORS) error {
	return a.config.SetCORS(a.ctx, accountID, bucket, cors)
}

// DeleteBucketCORS removes all CORS rules.
func (a *App) DeleteBucketCORS(accountID, bucket string) error {
	return a.config.DeleteCORS(a.ctx, accountID, bucket)
}

// GetBucketWebsite returns static website configuration.
func (a *App) GetBucketWebsite(accountID, bucket string) (*config.BucketWebsite, error) {
	return a.config.GetWebsite(a.ctx, accountID, bucket)
}

// SetBucketWebsite updates static website configuration.
func (a *App) SetBucketWebsite(accountID, bucket string, website *config.BucketWebsite) error {
	return a.config.SetWebsite(a.ctx, accountID, bucket, website)
}

// DeleteBucketWebsite removes the static website configuration.
func (a *App) DeleteBucketWebsite(accountID, bucket string) error {
	return a.config.DeleteWebsite(a.ctx, accountID, bucket)
}

// GetBucketPolicy returns the bucket policy.
func (a *App) GetBucketPolicy(accountID, bucket string) (*config.BucketPolicy, error) {
	return a.config.GetPolicy(a.ctx, accountID, bucket)
}

// SetBucketPolicy upserts the policy document.
func (a *App) SetBucketPolicy(accountID, bucket string, policy *config.BucketPolicy) error {
	return a.config.SetPolicy(a.ctx, accountID, bucket, policy)
}

// DeleteBucketPolicy removes the policy document.
func (a *App) DeleteBucketPolicy(accountID, bucket string) error {
	return a.config.DeletePolicy(a.ctx, accountID, bucket)
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

// RenameObject renames an object inside the same bucket.
func (a *App) RenameObject(accountID, bucket, oldKey, newKey string) error {
	return a.objects.RenameObject(a.ctx, accountID, bucket, oldKey, newKey)
}

// HeadObject fetches metadata for a specific key.
func (a *App) HeadObject(accountID, bucket, key string) (objects.ObjectInfo, error) {
	return a.objects.HeadObject(a.ctx, accountID, bucket, key)
}

// GetPresignedDownloadURL returns a GET URL valid for the requested duration in minutes.
func (a *App) GetPresignedDownloadURL(accountID, bucket, key string, expirationMinutes int64) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	return a.objects.GetPresignedURL(a.ctx, accountID, bucket, key, expirationMinutes*60, "GET")
}

// GetPresignedUploadURL returns a PUT URL for direct uploads.
func (a *App) GetPresignedUploadURL(accountID, bucket, key string, expirationMinutes int64) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	return a.objects.GetPresignedURL(a.ctx, accountID, bucket, key, expirationMinutes*60, "PUT")
}

// InitiateMultipartUpload creates a multipart upload session.
func (a *App) InitiateMultipartUpload(accountID, bucket, key string) (string, error) {
	return a.objects.InitiateMultipartUpload(a.ctx, accountID, bucket, key)
}

// UploadPart uploads a single chunk to an existing multipart session.
func (a *App) UploadPart(accountID, bucket, key, uploadID string, partNumber int, data []byte) (string, error) {
	return a.objects.UploadPart(a.ctx, accountID, bucket, key, uploadID, partNumber, data)
}

// CompleteMultipartUpload finalises all parts for a key.
func (a *App) CompleteMultipartUpload(accountID, bucket, key, uploadID string, parts map[int]string) error {
	return a.objects.CompleteMultipartUpload(a.ctx, accountID, bucket, key, uploadID, parts)
}

// AbortMultipartUpload cancels an in-flight multipart upload.
func (a *App) AbortMultipartUpload(accountID, bucket, key, uploadID string) error {
	return a.objects.AbortMultipartUpload(a.ctx, accountID, bucket, key, uploadID)
}

// ListTransferTasks returns current transfer queue snapshot.
func (a *App) ListTransferTasks() ([]*transfer.TransferTask, error) {
	return a.transfers.ListTasks(a.ctx)
}

// CancelTransferTask stops an in-progress transfer.
func (a *App) CancelTransferTask(taskID string) error {
	return a.transfers.CancelTask(a.ctx, taskID)
}

// PauseTransferTask requests the transfer to pause.
func (a *App) PauseTransferTask(taskID string) error {
	return a.transfers.PauseTask(a.ctx, taskID)
}

// ResumeTransferTask marks a paused transfer as running again.
func (a *App) ResumeTransferTask(taskID string) error {
	return a.transfers.ResumeTask(a.ctx, taskID)
// SearchObjects performs bucket-wide search with filters.
func (a *App) SearchObjects(accountID string, query *search.SearchQuery) (*search.SearchResponse, error) {
	return a.search.SearchObjects(a.ctx, accountID, query)
}

// ExportSearchResults exports search outcomes into csv/json formats.
func (a *App) ExportSearchResults(accountID string, query *search.SearchQuery, format string) ([]byte, error) {
	return a.search.ExportSearchResults(a.ctx, accountID, query, format)
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
