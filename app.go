package main

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"can/internal/accounts"
	"can/internal/providers"
	"can/internal/security"
	"can/internal/types"
)

// App struct
type App struct {
	ctx      context.Context
	accounts *accounts.Service
}

// NewApp creates a new App application struct
func NewApp() *App {
	store := accounts.NewMemoryStore()
	cipher := security.DefaultCipher()
	dialer := providers.NewStubDialer()
	svc := accounts.NewService(store, cipher, dialer)
	return &App{accounts: svc}
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

// Greet returns a greeting for the given name (legacy sample kept for smoke tests).
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}
