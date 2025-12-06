package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"can/internal/accounts"
	"can/internal/buckets"
	"can/internal/config"
	"can/internal/configfacade"
	"can/internal/objects"
	"can/internal/providers"
	"can/internal/search"
	"can/internal/security"
	"can/internal/sync"
	"can/internal/transfer"
	"can/internal/types"
)

// App struct
type App struct {
	ctx            context.Context
	requestTimeout time.Duration
	accounts       *accounts.Service
	buckets        *buckets.Service
	objects        *objects.Service
	transfers      *transfer.Service
	config         *configfacade.Service
	search         *search.Service
	sync           sync.Service
}

// NewApp creates a new App application struct
func NewApp() *App {
	store := initStoreFromEnv()
	cipher := security.DefaultCipher()
	s3Factory := providers.NewS3ClientFactory()
	storageFactory := providers.NewStorageFactory(s3Factory)
	clientPool := providers.NewClientPool(storageFactory)
	dialer := providers.NewS3Dialer(providers.WithS3ClientFactory(s3Factory))
	sessionStore := initSessionStore()
	accountSvc := accounts.NewService(store, cipher, dialer, sessionStore)
	accountSvc.SetClientPool(clientPool)
	bucketSvc := buckets.NewService(accountSvc, clientPool)
	transferStore := initTransferStore()
	transferSvc := transfer.NewService(accountSvc, clientPool, transferStore)
	objectSvc := objects.NewService(accountSvc, clientPool, transferSvc)
	configSvc := config.NewBucketConfigService(accountSvc, s3Factory)
	configFacade := configfacade.NewService(accountSvc, configSvc)
	searchStore := initSearchStore()
	searchSvc := search.NewService(accountSvc, clientPool, searchStore)
	syncSvc := sync.NewService(accountSvc, transferSvc, clientPool)
	return &App{
		requestTimeout: resolveRequestTimeout(),
		accounts:       accountSvc,
		buckets:        bucketSvc,
		objects:        objectSvc,
		transfers:      transferSvc,
		config:         configFacade,
		search:         searchSvc,
		sync:           syncSvc,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.ListAccounts(ctx)
}

// CreateAccount registers a new account configuration.
func (a *App) CreateAccount(input accounts.CreateAccountInput) (accounts.Account, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.CreateAccount(ctx, input)
}

// UpdateAccount updates an existing account configuration.
func (a *App) UpdateAccount(id string, input accounts.UpdateAccountInput) (accounts.Account, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.UpdateAccount(ctx, id, input)
}

// DeleteAccount removes the account with the given ID.
func (a *App) DeleteAccount(id string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.DeleteAccount(ctx, id)
}

// SetActiveAccount marks an account as active for the current session.
func (a *App) SetActiveAccount(id string) (accounts.Account, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.SetActiveAccount(ctx, id)
}

// ActiveAccount returns the current active account if set.
func (a *App) ActiveAccount() (*accounts.Account, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.ActiveAccount(ctx)
}

// TestAccountConnection validates the credentials for an account.
func (a *App) TestAccountConnection(id string) (accounts.ConnectionTestResult, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.TestConnection(ctx, id)
}

// TestAccountConnectionPreview validates credentials before persisting.
func (a *App) TestAccountConnectionPreview(input accounts.CreateAccountInput) (accounts.ConnectionTestResult, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.TestConnectionWithInput(ctx, input)
}

// ListBuckets returns all buckets for the given account.
func (a *App) ListBuckets(accountID string) ([]buckets.BucketInfo, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.ListBuckets(ctx, accountID)
}

// CreateBucket provisions a new bucket under the provided account.
func (a *App) CreateBucket(accountID, name, region string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.CreateBucket(ctx, accountID, name, region)
}

// DeleteBucket removes the selected bucket.
func (a *App) DeleteBucket(accountID, name string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.DeleteBucket(ctx, accountID, name)
}

// BucketLocation resolves the region for a bucket.
func (a *App) BucketLocation(accountID, name string) (string, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.BucketLocation(ctx, accountID, name)
}

// HeadBucket checks whether a bucket exists.
func (a *App) HeadBucket(accountID, name string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.buckets.HeadBucket(ctx, accountID, name)
}

// GetBucketVersioning returns versioning status for a bucket.
func (a *App) GetBucketVersioning(accountID, bucket string) (*config.BucketVersioning, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetVersioning(ctx, accountID, bucket)
}

// EnableBucketVersioning enables versioning for a bucket.
func (a *App) EnableBucketVersioning(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.EnableVersioning(ctx, accountID, bucket)
}

// SuspendBucketVersioning suspends versioning for a bucket.
func (a *App) SuspendBucketVersioning(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SuspendVersioning(ctx, accountID, bucket)
}

// GetBucketEncryption fetches the default encryption configuration.
func (a *App) GetBucketEncryption(accountID, bucket string) (*config.BucketEncryption, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetEncryption(ctx, accountID, bucket)
}

// SetBucketEncryption updates default encryption configuration.
func (a *App) SetBucketEncryption(accountID, bucket string, encryption *config.BucketEncryption) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetEncryption(ctx, accountID, bucket, encryption)
}

// DeleteBucketEncryption clears default encryption settings.
func (a *App) DeleteBucketEncryption(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeleteEncryption(ctx, accountID, bucket)
}

// GetBucketLifecycle lists lifecycle rules.
func (a *App) GetBucketLifecycle(accountID, bucket string) ([]*config.LifecycleRule, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetLifecycle(ctx, accountID, bucket)
}

// SetBucketLifecycle replaces lifecycle rules.
func (a *App) SetBucketLifecycle(accountID, bucket string, rules []*config.LifecycleRule) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetLifecycle(ctx, accountID, bucket, rules)
}

// DeleteBucketLifecycle removes lifecycle rules.
func (a *App) DeleteBucketLifecycle(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeleteLifecycle(ctx, accountID, bucket)
}

// GetBucketCORS returns CORS rules.
func (a *App) GetBucketCORS(accountID, bucket string) (*config.BucketCORS, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetCORS(ctx, accountID, bucket)
}

// SetBucketCORS upserts CORS rules.
func (a *App) SetBucketCORS(accountID, bucket string, cors *config.BucketCORS) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetCORS(ctx, accountID, bucket, cors)
}

// DeleteBucketCORS removes all CORS rules.
func (a *App) DeleteBucketCORS(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeleteCORS(ctx, accountID, bucket)
}

// GetBucketWebsite returns static website configuration.
func (a *App) GetBucketWebsite(accountID, bucket string) (*config.BucketWebsite, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetWebsite(ctx, accountID, bucket)
}

// SetBucketWebsite updates static website configuration.
func (a *App) SetBucketWebsite(accountID, bucket string, website *config.BucketWebsite) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetWebsite(ctx, accountID, bucket, website)
}

// DeleteBucketWebsite removes the static website configuration.
func (a *App) DeleteBucketWebsite(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeleteWebsite(ctx, accountID, bucket)
}

// GetBucketPolicy returns the bucket policy.
func (a *App) GetBucketPolicy(accountID, bucket string) (*config.BucketPolicy, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.GetPolicy(ctx, accountID, bucket)
}

// SetBucketPolicy upserts the policy document.
func (a *App) SetBucketPolicy(accountID, bucket string, policy *config.BucketPolicy) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.SetPolicy(ctx, accountID, bucket, policy)
}

// DeleteBucketPolicy removes the policy document.
func (a *App) DeleteBucketPolicy(accountID, bucket string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.config.DeletePolicy(ctx, accountID, bucket)
}

// ListObjects enumerates objects under the given prefix.
func (a *App) ListObjects(accountID string, input objects.ListObjectsInput) (objects.ListObjectsResult, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.ListObjects(ctx, accountID, input)
}

// UploadObject uploads a local file to the target bucket.
func (a *App) UploadObject(accountID, bucket, key, filePath string) (*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UploadObject(ctx, accountID, bucket, key, filePath)
}

// DownloadObject downloads an object to the provided path.
func (a *App) DownloadObject(accountID, bucket, key, savePath string) (*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DownloadObject(ctx, accountID, bucket, key, savePath)
}

// DeleteObject removes an object from the bucket.
func (a *App) DeleteObject(accountID, bucket, key string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.DeleteObject(ctx, accountID, bucket, key)
}

// CopyObject duplicates an object to a new location.
func (a *App) CopyObject(accountID, sourceBucket, sourceKey, targetBucket, targetKey string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CopyObject(ctx, accountID, sourceBucket, sourceKey, targetBucket, targetKey)
}

// RenameObject renames an object inside the same bucket.
func (a *App) RenameObject(accountID, bucket, oldKey, newKey string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.RenameObject(ctx, accountID, bucket, oldKey, newKey)
}

// HeadObject fetches metadata for a specific key.
func (a *App) HeadObject(accountID, bucket, key string) (objects.ObjectInfo, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.HeadObject(ctx, accountID, bucket, key)
}

// GetPresignedDownloadURL returns a GET URL valid for the requested duration in minutes.
func (a *App) GetPresignedDownloadURL(accountID, bucket, key string, expirationMinutes int64) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetPresignedURL(ctx, accountID, bucket, key, expirationMinutes*60, "GET")
}

// GetPresignedUploadURL returns a PUT URL for direct uploads.
func (a *App) GetPresignedUploadURL(accountID, bucket, key string, expirationMinutes int64) (string, error) {
	if expirationMinutes <= 0 {
		expirationMinutes = 60
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.GetPresignedURL(ctx, accountID, bucket, key, expirationMinutes*60, "PUT")
}

// InitiateMultipartUpload creates a multipart upload session.
func (a *App) InitiateMultipartUpload(accountID, bucket, key string) (string, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.InitiateMultipartUpload(ctx, accountID, bucket, key)
}

// UploadPart uploads a single chunk to an existing multipart session.
func (a *App) UploadPart(accountID, bucket, key, uploadID string, partNumber int, data []byte) (string, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.UploadPart(ctx, accountID, bucket, key, uploadID, partNumber, data)
}

// CompleteMultipartUpload finalises all parts for a key.
func (a *App) CompleteMultipartUpload(accountID, bucket, key, uploadID string, parts map[int]string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.CompleteMultipartUpload(ctx, accountID, bucket, key, uploadID, parts)
}

// AbortMultipartUpload cancels an in-flight multipart upload.
func (a *App) AbortMultipartUpload(accountID, bucket, key, uploadID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.objects.AbortMultipartUpload(ctx, accountID, bucket, key, uploadID)
}

// ListTransferTasks returns current transfer queue snapshot.
func (a *App) ListTransferTasks() ([]*transfer.TransferTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.ListTasks(ctx)
}

// CancelTransferTask stops an in-progress transfer.
func (a *App) CancelTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.CancelTask(ctx, taskID)
}

// PauseTransferTask requests the transfer to pause.
func (a *App) PauseTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.PauseTask(ctx, taskID)
}

// ResumeTransferTask marks a paused transfer as running again.
func (a *App) ResumeTransferTask(taskID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.transfers.ResumeTask(ctx, taskID)
}

// SearchObjects performs bucket-wide search with filters.
func (a *App) SearchObjects(accountID string, query *search.SearchQuery) (*search.SearchResponse, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.SearchObjects(ctx, accountID, query)
}

// ExportSearchResults exports search outcomes into csv/json formats.
func (a *App) ExportSearchResults(accountID string, query *search.SearchQuery, format string) ([]byte, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.ExportSearchResults(ctx, accountID, query, format)
}

// SetTransferSpeedLimit sets the global transfer speed limit in bytes per second.
// A value of 0 or negative disables rate limiting.
func (a *App) SetTransferSpeedLimit(bytesPerSec int64) {
	a.transfers.SetGlobalSpeedLimit(bytesPerSec)
}

// GetTransferSpeedLimit returns the current global speed limit in bytes per second.
func (a *App) GetTransferSpeedLimit() int64 {
	return a.transfers.GetGlobalSpeedLimit()
}

// SaveSearchQuery persists a search query configuration with the given name.
func (a *App) SaveSearchQuery(name string, query *search.SearchQuery) (*search.SavedQuery, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.SaveQuery(ctx, name, query)
}

// ListSavedSearchQueries returns all saved search queries.
func (a *App) ListSavedSearchQueries() ([]*search.SavedQuery, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.ListSavedQueries(ctx)
}

// DeleteSavedSearchQuery removes a saved query by ID.
func (a *App) DeleteSavedSearchQuery(id string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.DeleteSavedQuery(ctx, id)
}

// UpdateSavedSearchQuery updates an existing saved query's name and/or query configuration.
func (a *App) UpdateSavedSearchQuery(id string, name string, query *search.SearchQuery) (*search.SavedQuery, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.search.UpdateSavedQuery(ctx, id, name, query)
}

// ExportAccounts writes all stored account configs into an encrypted bundle via SaveFileDialog.
func (a *App) ExportAccounts() (accounts.ExportSummary, error) {
	var summary accounts.ExportSummary
	if a.ctx == nil {
		return summary, errors.New("application context not ready")
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	payload, err := a.accounts.ExportData(ctx)
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
	ctx, cancel := a.backgroundContext()
	defer cancel()
	result, err := a.accounts.ImportData(ctx, blob)
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

const defaultRequestTimeout = 60 * time.Second

func resolveRequestTimeout() time.Duration {
	raw := strings.TrimSpace(os.Getenv("CAN_REQUEST_TIMEOUT"))
	if raw == "" {
		return defaultRequestTimeout
	}
	if duration, err := time.ParseDuration(raw); err == nil && duration > 0 {
		return duration
	}
	if seconds, err := strconv.Atoi(raw); err == nil && seconds > 0 {
		return time.Duration(seconds) * time.Second
	}
	fmt.Printf("invalid CAN_REQUEST_TIMEOUT %q, fallback to %s\n", raw, defaultRequestTimeout)
	return defaultRequestTimeout
}

func (a *App) requestContext(parent context.Context) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	timeout := a.requestTimeout
	if timeout <= 0 {
		timeout = defaultRequestTimeout
	}
	return context.WithTimeout(parent, timeout)
}

func (a *App) backgroundContext() (context.Context, context.CancelFunc) {
	return a.requestContext(context.Background())
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

func initTransferStore() transfer.Store {
	path := strings.TrimSpace(os.Getenv("CAN_TRANSFER_DB"))
	if path == "" {
		var err error
		path, err = defaultTransferPath()
		if err != nil {
			fmt.Printf("failed to resolve default transfer db path, using memory store: %v\n", err)
			return transfer.NewMemoryStore()
		}
	}
	store, err := transfer.NewSQLiteStore(path)
	if err != nil {
		fmt.Printf("failed to init transfer sqlite store (%s): %v\n", path, err)
		return transfer.NewMemoryStore()
	}
	return store
}

func defaultSQLitePath() (string, error) {
	dir, err := defaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "accounts.db"), nil
}

func defaultTransferPath() (string, error) {
	dir, err := defaultDataDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "transfers.db"), nil
}

func defaultDataDir() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = filepath.Join(os.TempDir(), "can")
	} else {
		dir = filepath.Join(dir, "can")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
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
