package app

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"can/internal/accounts"
	"can/internal/types"
	"can/internal/validation"

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
	if err := validation.ValidateStruct(input); err != nil {
		return accounts.Account{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.CreateAccount(ctx, input)
}

// UpdateAccount updates an existing account configuration.
func (a *App) UpdateAccount(id string, input accounts.UpdateAccountInput) (accounts.Account, error) {
	if err := validateAccountID(id); err != nil {
		return accounts.Account{}, err
	}
	if err := validation.ValidateStruct(input); err != nil {
		return accounts.Account{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.UpdateAccount(ctx, id, input)
}

// DeleteAccount removes the account with the given ID.
func (a *App) DeleteAccount(id string) error {
	if err := validateAccountID(id); err != nil {
		return err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.DeleteAccount(ctx, id)
}

// SetActiveAccount marks an account as active for the current session.
func (a *App) SetActiveAccount(id string) (accounts.Account, error) {
	if err := validateAccountID(id); err != nil {
		return accounts.Account{}, err
	}
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

// Dial validates the credentials for an account (persisted or preview).
// It returns the list of buckets if successful.
func (a *App) Dial(id string) (accounts.DialResult, error) {
	if err := validateAccountID(id); err != nil {
		return accounts.DialResult{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.Dial(ctx, id)
}

// DialPreview validates credentials before persisting.
// It returns the list of buckets if successful.
func (a *App) DialPreview(input accounts.CreateAccountInput) (accounts.DialResult, error) {
	if strings.TrimSpace(input.Name) == "" {
		input.Name = "connection-test"
	}
	if err := validation.ValidateStruct(input); err != nil {
		return accounts.DialResult{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.accounts.DialWithInput(ctx, input)
}

// AccountCredentials holds decrypted credentials for editing purposes.
type AccountCredentials struct {
	AccessKeyID     string `json:"accessKeyId"`
	SecretAccessKey string `json:"secretAccessKey"`
}

// GetAccountCredentials returns decrypted credentials for an account (for editing).
func (a *App) GetAccountCredentials(id string) (AccountCredentials, error) {
	if err := validateAccountID(id); err != nil {
		return AccountCredentials{}, err
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	creds, err := a.accounts.Credentials(ctx, id)
	if err != nil {
		return AccountCredentials{}, err
	}
	return AccountCredentials{
		AccessKeyID:     creds.AccessKeyID,
		SecretAccessKey: creds.SecretAccessKey,
	}, nil
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
		DefaultFilename: fmt.Sprintf("can-accounts-%s.json", time.Now().Format("20060102-150405")),
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
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
		path += ".json"
	}
	if err := os.WriteFile(path, payload.Blob, 0o600); err != nil {
		return summary, err
	}
	summary.FilePath = path
	summary.Count = payload.Count
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
			{DisplayName: "JSON Files (*.json)", Pattern: "*.json"},
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

// GetProviderFeatures returns the feature list for a specific account's provider.
func (a *App) GetProviderFeatures(accountID string) ([]types.ProviderFeature, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	creds, err := a.accounts.Credentials(ctx, accountID)
	if err != nil {
		return nil, err
	}
	return types.ProviderFeatures(creds.Provider), nil
}

// HasProviderFeature checks if an account's provider supports a specific feature.
func (a *App) HasProviderFeature(accountID string, featureID string) (bool, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	creds, err := a.accounts.Credentials(ctx, accountID)
	if err != nil {
		return false, err
	}
	return types.HasFeature(creds.Provider, types.FeatureID(featureID)), nil
}

// ImportAccountsBatch batch imports accounts from a CSV or JSON file selected via OpenFileDialog.
func (a *App) ImportAccountsBatch() (accounts.BatchImportSummary, error) {
	var summary accounts.BatchImportSummary
	if a.ctx == nil {
		return summary, errors.New("application context not ready")
	}

	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "批量导入账户",
		Filters: []runtime.FileFilter{
			{DisplayName: "CSV 文件 (*.csv)", Pattern: "*.csv"},
			{DisplayName: "JSON 文件 (*.json)", Pattern: "*.json"},
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

	// Determine format from file extension
	format := "json"
	if strings.HasSuffix(strings.ToLower(path), ".csv") {
		format = "csv"
	}

	ctx, cancel := a.backgroundContext()
	defer cancel()

	result, err := a.accounts.ImportBatchData(ctx, blob, format)
	if err != nil {
		return summary, err
	}

	summary.Total = result.Total
	summary.Imported = result.Imported
	summary.Skipped = result.Skipped
	summary.Failed = result.Failed
	summary.Errors = result.Errors

	return summary, nil
}

func validateAccountID(id string) error {
	payload := struct {
		ID string `validate:"required"`
	}{ID: id}
	return validation.ValidateStruct(payload)
}

// DownloadImportTemplate saves an import template file via SaveFileDialog.
func (a *App) DownloadImportTemplate(format string) error {
	if a.ctx == nil {
		return errors.New("application context not ready")
	}

	var filename string
	var content []byte

	switch strings.ToLower(format) {
	case "csv":
		filename = "账户导入模板.csv"
		content = accounts.GenerateCSVTemplate()
	case "json":
		filename = "账户导入模板.json"
		content = accounts.GenerateJSONTemplate()
	default:
		return fmt.Errorf("不支持的格式: %s", format)
	}

	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "保存导入模板",
		DefaultFilename: filename,
	})
	if err != nil {
		return err
	}
	if path == "" {
		return nil // User cancelled
	}

	return os.WriteFile(path, content, 0o644)
}
