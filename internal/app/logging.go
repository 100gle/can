package app

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	canLogger "can/internal/logger"
)

// loggerInstance holds the global logger reference
var loggerInstance *canLogger.WailsLogger

// SetLogger sets the global logger instance (called from main.go)
func SetLogger(l *canLogger.WailsLogger) {
	loggerInstance = l
}

// LogWithContext logs a message with module and context - exposed to frontend
func (a *App) LogWithContext(level, module, message string, context map[string]any) {
	if loggerInstance != nil {
		loggerInstance.LogWithContext(level, module, message, context)
	}
}

// LogBatch logs multiple entries at once - exposed to frontend for batch logging
func (a *App) LogBatch(entries []canLogger.LogEntry) {
	if loggerInstance != nil {
		loggerInstance.LogBatch(entries)
	}
}

// SetLogLevel sets the logging level at runtime - exposed to frontend
func (a *App) SetLogLevel(level string) error {
	if loggerInstance == nil {
		return fmt.Errorf("logger not initialized")
	}
	loggerInstance.SetLevel(canLogger.LogLevel(level))
	return nil
}

// GetLogLevel returns the current logging level - exposed to frontend
func (a *App) GetLogLevel() string {
	if loggerInstance == nil {
		return "info"
	}
	return string(loggerInstance.GetLevel())
}

// GetLogDirectory returns the log directory path - exposed to frontend
func (a *App) GetLogDirectory() string {
	if loggerInstance == nil {
		return ""
	}
	return loggerInstance.GetLogDir()
}

// OpenLogDirectory opens the log directory in the OS file explorer
func (a *App) OpenLogDirectory() error {
	logDir := a.GetLogDirectory()
	if logDir == "" {
		return fmt.Errorf("log directory not available")
	}

	// Use OS-specific command to open directory
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", logDir)
	case "windows":
		cmd = exec.Command("explorer", logDir)
	default: // linux and others
		cmd = exec.Command("xdg-open", logDir)
	}

	return cmd.Start()
}

// ExportLogs packages recent logs into a zip file at the specified path
func (a *App) ExportLogs(targetPath string) (string, error) {
	logDir := a.GetLogDirectory()
	if logDir == "" {
		return "", fmt.Errorf("log directory not available")
	}

	if targetPath == "" {
		return "", fmt.Errorf("target path not specified")
	}

	// Ensure .zip extension
	if filepath.Ext(targetPath) != ".zip" {
		targetPath = targetPath + ".zip"
	}

	// Create zip file
	zipFile, err := os.Create(targetPath)
	if err != nil {
		return "", fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	// Walk through log directory and add files
	err = filepath.Walk(logDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories
		if info.IsDir() {
			return nil
		}

		// Only include .log and .gz files (skip zip files we just created)
		ext := filepath.Ext(path)
		if ext != ".log" && ext != ".gz" {
			return nil
		}

		// Create zip entry
		relPath, err := filepath.Rel(logDir, path)
		if err != nil {
			return err
		}

		writer, err := zipWriter.Create(relPath)
		if err != nil {
			return err
		}

		// Copy file content
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(writer, file)
		return err
	})

	if err != nil {
		return "", fmt.Errorf("failed to package logs: %w", err)
	}

	return targetPath, nil
}

// CloseLogger flushes and closes the logger file handles.
func CloseLogger() {
	if loggerInstance != nil {
		_ = loggerInstance.Close()
	}
}
