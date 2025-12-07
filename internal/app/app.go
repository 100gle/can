package app

import (
	"context"
	"fmt"
	"time"

	"can/internal/accounts"
	"can/internal/backup"
	"can/internal/bootstrap"
	"can/internal/buckets"
	"can/internal/config"
	"can/internal/configfacade"
	"can/internal/objects"
	"can/internal/providers"
	"can/internal/search"
	"can/internal/security"
	"can/internal/system"
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
	system         *system.Service
	backup         backup.Service
	audit          *security.Service
	quitRequested  bool
}

// New creates a new App application struct
func New() *App {
	store := bootstrap.InitAccountsStore()
	cipher := security.DefaultCipher()

	// Audit
	auditDBPath, _ := bootstrap.DefaultAuditPath()
	var auditSvc *security.Service
	auditStore, err := security.NewSQLiteAuditStore(auditDBPath)
	if err != nil {
		panic(fmt.Sprintf("failed to open audit db: %v", err))
	}
	if err := auditStore.Init(); err != nil {
		panic(fmt.Sprintf("failed to init audit schema: %v", err))
	}
	auditSvc = security.NewService(auditStore)

	s3Factory := providers.NewS3ClientFactory()
	storageFactory := providers.NewStorageFactory(s3Factory)
	clientPool := providers.NewClientPool(storageFactory)
	dialer := providers.NewS3Dialer(providers.WithS3ClientFactory(s3Factory))
	sessionStore := bootstrap.InitSessionStore()
	accountSvc := accounts.NewService(store, cipher, dialer, sessionStore)
	accountSvc.SetClientPool(clientPool)
	bucketSvc := buckets.NewService(accountSvc, clientPool)
	transferStore := bootstrap.InitTransferStore()
	transferSvc := transfer.NewService(accountSvc, clientPool, transferStore)
	linkHistoryStore := bootstrap.InitLinkHistoryStore()
	objectSvc := objects.NewService(accountSvc, clientPool, transferSvc, linkHistoryStore, auditSvc)
	configSvc := config.NewBucketConfigService(accountSvc, s3Factory, storageFactory)
	configFacade := configfacade.NewService(accountSvc, configSvc)
	searchStore := bootstrap.InitSearchStore()
	searchSvc := search.NewService(accountSvc, clientPool, searchStore)

	systemSvc := system.NewService(func() int {
		count, _ := transferSvc.CountActiveTasks(context.Background())
		return count
	})

	// Backup Service Init
	dataDir, _ := bootstrap.DefaultDataDir() // Best effort
	backupSvc := backup.NewService(accountSvc, objectSvc, dataDir)

	return &App{
		requestTimeout: bootstrap.ResolveRequestTimeout(),
		accounts:       accountSvc,
		buckets:        bucketSvc,
		objects:        objectSvc,
		transfers:      transferSvc,
		config:         configFacade,
		search:         searchSvc,
		system:         systemSvc,
		backup:         backupSvc,
		audit:          auditSvc,
	}
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
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
