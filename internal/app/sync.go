package app

import (
	"can/internal/sync"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// CreateSyncRule registers a new synchronization rule.
func (a *App) CreateSyncRule(rule *sync.SyncRule) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.sync.CreateRule(ctx, rule)
}

// UpdateSyncRule updates an existing synchronization rule.
func (a *App) UpdateSyncRule(rule *sync.SyncRule) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.sync.UpdateRule(ctx, rule)
}

// DeleteSyncRule removes a synchronization rule by ID.
func (a *App) DeleteSyncRule(id string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.sync.DeleteRule(ctx, id)
}

// ListSyncRules returns all configured synchronization rules.
func (a *App) ListSyncRules() ([]*sync.SyncRule, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.sync.ListRules(ctx)
}

// GetSyncRule retrieves a single synchronization rule by ID.
func (a *App) GetSyncRule(id string) (*sync.SyncRule, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.sync.GetRule(ctx, id)
}

// StartSyncRule triggers synchronization for a specific rule.
func (a *App) StartSyncRule(ruleID string) (*sync.SyncTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.sync.StartSync(ctx, ruleID)
}

// StopSyncRule stops an ongoing synchronization task.
func (a *App) StopSyncRule(ruleID string) error {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.sync.StopSync(ctx, ruleID)
}

// ListSyncTasks returns the execution history for a rule.
func (a *App) ListSyncTasks(ruleID string) ([]*sync.SyncTask, error) {
	ctx, cancel := a.backgroundContext()
	defer cancel()
	return a.sync.ListTasks(ctx, ruleID)
}

// SelectLocalFolder opens a directory picker dialog and returns the selected path.
func (a *App) SelectLocalFolder() (string, error) {
	if a.ctx == nil {
		return "", nil
	}
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择本地文件夹",
	})
}
