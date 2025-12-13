package app

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

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

// CheckForUpdates queries remote releases and reports availability.
func (a *App) CheckForUpdates(currentVersion string) (system.UpdateInfo, error) {
	if a.system == nil {
		return system.UpdateInfo{}, fmt.Errorf("system service unavailable")
	}
	ctx, cancel := a.requestContext(a.ctx)
	defer cancel()
	return a.system.CheckForUpdates(ctx, currentVersion)
}

// SelectLocalFolder prompts the user to choose a folder via a directory dialog.
// Used by backup/restore and other features requiring local folder access.
func (a *App) SelectLocalFolder(title string) (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
}

// GetDefaultDownloadDir returns the user's default downloads directory.
// Falls back to temp directory if downloads directory is not available.
func (a *App) GetDefaultDownloadDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return os.TempDir()
	}
	downloadsDir := filepath.Join(home, "Downloads")
	if info, err := os.Stat(downloadsDir); err == nil && info.IsDir() {
		return downloadsDir
	}
	return os.TempDir()
}

// ShowPathInFileManager reveals a file or folder in the system file manager.
// On macOS this opens Finder with the file selected.
func (a *App) ShowPathInFileManager(path string) error {
	path = filepath.Clean(path)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return fmt.Errorf("path does not exist: %s", path)
	}
	// On macOS, use 'open -R' to reveal in Finder
	cmd := exec.Command("open", "-R", path)
	return cmd.Start()
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

// OpenMultipleFilesDialog prompts the user to select multiple files.
// Returns a slice of selected file paths or empty slice if cancelled.
func (a *App) OpenMultipleFilesDialog(title string, filters []FileFilter) ([]string, error) {
	var runtimeFilters []runtime.FileFilter
	for _, f := range filters {
		runtimeFilters = append(runtimeFilters, runtime.FileFilter{
			DisplayName: f.DisplayName,
			Pattern:     f.Pattern,
		})
	}

	paths, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   title,
		Filters: runtimeFilters,
	})

	return paths, err
}

// FileFilter represents a file type filter for dialogs
type FileFilter struct {
	DisplayName string `json:"displayName"`
	Pattern     string `json:"pattern"`
}

// PingEndpoint performs a lightweight reachability check for the provided URL or host.
// timeoutMs is optional; when <= 0, the backend default (5s) is used.
func (a *App) PingEndpoint(target string, timeoutMs int) system.PingResult {
	if a.system == nil {
		return system.PingResult{
			URL:       target,
			CheckedAt: time.Now(),
			Reason:    "system_unavailable",
			Error:     "system service unavailable",
			Online:    false,
		}
	}
	ctx, cancel := a.requestContext(a.ctx)
	defer cancel()
	var timeout time.Duration
	if timeoutMs > 0 {
		timeout = time.Duration(timeoutMs) * time.Millisecond
	}
	return a.system.PingEndpoint(ctx, target, timeout)
}

// DirectoryFilesResult contains the base path and all file paths found in a directory.
type DirectoryFilesResult struct {
	BasePath string   `json:"basePath"`
	Files    []string `json:"files"`
}

// OpenDirectoryDialogWithFiles prompts the user to select a directory,
// then recursively scans it to return all file paths along with the base path.
// This is used for folder uploads to preserve directory structure.
func (a *App) OpenDirectoryDialogWithFiles(title string) (*DirectoryFilesResult, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
	if err != nil {
		return nil, err
	}
	if dir == "" {
		// User cancelled
		return nil, nil
	}

	var files []string
	err = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// Skip files/dirs we can't access
			return nil
		}
		if !info.IsDir() {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to scan directory: %w", err)
	}

	return &DirectoryFilesResult{BasePath: dir, Files: files}, nil
}
