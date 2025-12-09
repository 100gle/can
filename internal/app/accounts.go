package app

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"can/internal/accounts"
	"can/internal/types"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

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

// GetProviderCapabilities returns the capability list for a specific account's provider.
func (a *App) GetProviderCapabilities(accountID string) ([]types.ProviderCapability, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	creds, err := a.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return nil, err
	}
	return types.ProviderCapabilities(creds.Provider), nil
}

// HasProviderCapability checks if an account's provider supports a specific feature.
func (a *App) HasProviderCapability(accountID string, featureID string) (bool, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	creds, err := a.accounts.ConnectionCredentials(ctx, accountID)
	if err != nil {
		return false, err
	}
	return types.HasCapability(creds.Provider, types.FeatureID(featureID)), nil
}
