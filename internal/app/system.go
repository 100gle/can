package app

import (
	"can/internal/system"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// GetSystemMetrics returns current system performance metrics.
func (a *App) GetSystemMetrics() system.SystemMetrics {
	if a.system == nil {
		return system.SystemMetrics{}
	}
	return a.system.GetMetrics()
}

// SelectLocalFolder opens a directory picker dialog and returns the selected path.
func (a *App) SelectLocalFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择保存目录",
	})
}
