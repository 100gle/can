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

// SelectLocalFolder prompts the user to choose a folder via a directory dialog.
// Used by backup/restore and other features requiring local folder access.
func (a *App) SelectLocalFolder(title string) (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
}

// SaveFileDialog prompts the user to select a save location for a file.
// Returns the selected file path or empty string if cancelled.
func (a *App) SaveFileDialog(title, defaultFilename string, filters []FileFilter) (string, error) {
	var runtimeFilters []runtime.FileFilter
	for _, f := range filters {
		runtimeFilters = append(runtimeFilters, runtime.FileFilter{
			DisplayName: f.DisplayName,
			Pattern:     f.Pattern,
		})
	}

	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:                      title,
		DefaultFilename:            defaultFilename,
		Filters:                    runtimeFilters,
		CanCreateDirectories:       true,
		TreatPackagesAsDirectories: false,
	})

	// If user cancels, wails returns empty string with no error
	// We return empty string as well to signal cancellation
	return path, err
}

// OpenFileDialog prompts the user to select a file to open.
// Returns the selected file path or empty string if cancelled.
func (a *App) OpenFileDialog(title string, filters []FileFilter) (string, error) {
	var runtimeFilters []runtime.FileFilter
	for _, f := range filters {
		runtimeFilters = append(runtimeFilters, runtime.FileFilter{
			DisplayName: f.DisplayName,
			Pattern:     f.Pattern,
		})
	}

	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   title,
		Filters: runtimeFilters,
	})

	return path, err
}

// FileFilter represents a file type filter for dialogs
type FileFilter struct {
	DisplayName string `json:"displayName"`
	Pattern     string `json:"pattern"`
}
