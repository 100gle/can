package app

import (
	"context"
	"sync/atomic"
	"time"

	"can/internal/accounts"
	"can/internal/bootstrap"
	"can/internal/buckets"
	"can/internal/config"
	"can/internal/objects"
	"can/internal/search"
	"can/internal/storage"
	"can/internal/storage/s3"
	"can/internal/types"

	"can/internal/system"
	"can/internal/system/backup"
	"can/internal/transfer"
)

// App struct
type App struct {
	ctx            context.Context
	requestTimeout time.Duration
	accounts       *accounts.Service
	buckets        *buckets.Service
	objects        *objects.Service
	transfers      *transfer.Service
	config         *config.BucketConfigService
	search         *search.Service
	system         *system.Service
	backup         backup.Service

	quitRequested       bool
	windowVisible       atomic.Bool
	networkOnline       atomic.Bool
	networkEventsCancel func()
}

// New creates a new App application struct

func New() *App {
	store := bootstrap.InitAccountsStore()
	cipher := accounts.DefaultCipher()

	clientPool := storage.NewClientPool(nil)
	storageFactory := storage.NewStorageFactory()

	dialer := s3.NewDialer()
	sessionStore := bootstrap.InitSessionStore()
	accountSvc := accounts.NewService(store, cipher, dialer, sessionStore)
	accountSvc.SetClientPool(clientPool)
	bucketSvc := buckets.NewService(accountSvc, clientPool)
	transferStore := bootstrap.InitTransferStore()
	transferSvc := transfer.NewService(accountSvc, clientPool, transferStore)
	objectSvc := objects.NewService(accountSvc, clientPool, transferSvc)
	configSvc := config.NewBucketConfigService(accountSvc, storageFactory)
	searchStore := bootstrap.InitSearchStore()
	searchSvc := search.NewService(accountSvc, clientPool, searchStore)

	systemSvc := system.NewService(func() int {
		count, _ := transferSvc.CountActiveTasks(context.Background())
		return count
	})

	// Backup Service Init
	dataDir, _ := bootstrap.DefaultDataDir() // Best effort
	backupSvc := backup.NewService(accountSvc, objectSvc, dataDir)

	instance := &App{
		requestTimeout: bootstrap.ResolveRequestTimeout(),
		accounts:       accountSvc,
		buckets:        bucketSvc,
		objects:        objectSvc,
		transfers:      transferSvc,
		config:         configSvc,
		search:         searchSvc,
		system:         systemSvc,
		backup:         backupSvc,
	}
	instance.windowVisible.Store(true)
	instance.networkOnline.Store(true)
	return instance
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	a.subscribeNetworkEvents(ctx)
}

// SupportedProviders exposes the providers metadata to the UI.
func (a *App) SupportedProviders() []types.ProviderMetadata {
	return types.KnownProviders()
}

// ProviderCapabilities exposes capability matrix to the UI.
func (a *App) ProviderCapabilities() []types.ProviderCapability {
	return types.CapabilityMatrix()
}

func (a *App) requestContext(parent context.Context) (context.Context, context.CancelFunc) {
	if parent == nil {
		parent = context.Background()
	}
	timeout := a.requestTimeout
	if timeout <= 0 {
		timeout = bootstrap.ResolveRequestTimeout() // Fallback check
	}
	return context.WithTimeout(parent, timeout)
}

func (a *App) backgroundContext() (context.Context, context.CancelFunc) {
	return a.requestContext(context.Background())
}
