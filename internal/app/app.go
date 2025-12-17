package app

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	"can/internal/accounts"
	"can/internal/bootstrap"
	"can/internal/buckets"
	"can/internal/config"
	"can/internal/objects"
	"can/internal/storage"
	"can/internal/types"

	"can/internal/system"
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
	system         *system.Service

	quitRequested       bool
	windowVisible       atomic.Bool
	networkOnline       atomic.Bool
	networkEventsCancel func()
}

// New creates a new App application struct

func New() *App {
	store := bootstrap.InitAccountsStore()
	vault := storage.NewClientVault(nil, nil)
	accountSvc := accounts.NewService(store)
	if err := accountSvc.SyncClients(context.Background(), vault); err != nil {
		panic(fmt.Sprintf("sync clients: %v", err))
	}
	bucketSvc := buckets.NewService(accountSvc, vault)
	transferStore := bootstrap.InitTransferStore()
	transferSvc := transfer.NewService(accountSvc, vault, transferStore)
	objectSvc := objects.NewService(accountSvc, vault, transferSvc)
	configSvc := config.NewBucketConfigService(accountSvc, vault)

	systemSvc := system.NewService()

	instance := &App{
		requestTimeout: bootstrap.ResolveRequestTimeout(),
		accounts:       accountSvc,
		buckets:        bucketSvc,
		objects:        objectSvc,
		transfers:      transferSvc,
		config:         configSvc,
		system:         systemSvc,
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

// ProviderFeatures exposes feature matrix to the UI.
func (a *App) ProviderFeatures() []types.ProviderFeature {
	return types.FeatureMatrix()
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
