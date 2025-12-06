package app

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// DomReady is called after the frontend resources have been loaded.
// Use this hook for operations that require the window to be ready.
func (a *App) DomReady(ctx context.Context) {
	// Log application ready state
	runtime.LogInfo(ctx, "Frontend DOM ready")
}

// BeforeClose is called when the user attempts to close the application.
// Return true to prevent the close, false to allow it.
func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	// Always show confirmation dialog before closing
	dialog, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "确认退出",
		Message:       "确定要退出应用吗？",
		Buttons:       []string{"取消", "确认退出"},
		DefaultButton: "取消",
		CancelButton:  "取消",
	})
	if err != nil {
		runtime.LogWarning(ctx, fmt.Sprintf("Failed to show dialog: %v", err))
		return false // Allow close on error
	}
	// Return true to prevent close if user clicked "取消"
	return dialog == "取消"
}

// Shutdown is called when the application is about to terminate.
// Use this hook for cleanup operations.
func (a *App) Shutdown(ctx context.Context) {
	runtime.LogInfo(ctx, "Application shutting down...")

	// 1. Close transfer queue and wait for workers to finish
	if a.transfers != nil {
		runtime.LogInfo(ctx, "Closing transfer service...")
		a.transfers.Close()
	}

	// 2. Stop all sync jobs
	if a.sync != nil {
		runtime.LogInfo(ctx, "Stopping sync jobs...")
		a.stopAllSyncJobs(ctx)
	}

	// 3. Cancel all migration jobs
	if a.migration != nil {
		runtime.LogInfo(ctx, "Cancelling migration jobs...")
		a.cancelAllMigrationJobs()
	}

	runtime.LogInfo(ctx, "Shutdown complete")
}

// stopAllSyncJobs stops all running sync jobs gracefully.
func (a *App) stopAllSyncJobs(ctx context.Context) {
	rules, err := a.sync.ListRules(ctx)
	if err != nil {
		return
	}
	for _, rule := range rules {
		_ = a.sync.StopSync(ctx, rule.ID)
	}
}

// cancelAllMigrationJobs cancels all running migration jobs.
func (a *App) cancelAllMigrationJobs() {
	jobs, err := a.migration.ListJobs()
	if err != nil {
		return
	}
	for _, job := range jobs {
		if job.Status == "running" || job.Status == "pending" {
			_ = a.migration.CancelJob(job.ID)
		}
	}
}

// ForceQuit allows the frontend to force quit after user confirmation.
func (a *App) ForceQuit() {
	runtime.Quit(a.ctx)
}

// OnSecondInstance is called when a second instance of the app is launched.
// It brings the existing window to the front.
func (a *App) OnSecondInstance(data options.SecondInstanceData) {
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
}
