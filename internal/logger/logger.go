// Package logger provides a unified logging infrastructure for the application.
// It wraps zerolog with lumberjack for log rotation and implements the Wails Logger interface.
package logger

import (
	"os"
	"path/filepath"
	"sync/atomic"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gopkg.in/natefinch/lumberjack.v2"
)

// LogLevel represents the logging level
type LogLevel string

const (
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
	LevelFatal LogLevel = "fatal"
)

// LogEntry represents a single log entry from the frontend
type LogEntry struct {
	Level     string         `json:"level"`
	Module    string         `json:"module"`
	Message   string         `json:"message"`
	Context   map[string]any `json:"context"`
	Timestamp int64          `json:"timestamp"`
}

// WailsLogger implements the Wails logger.Logger interface using zerolog
type WailsLogger struct {
	logger     zerolog.Logger
	level      atomic.Value // stores LogLevel
	logDir     string
	fileWriter *lumberjack.Logger
}

// Config holds the logger configuration
type Config struct {
	LogDir     string
	MaxSizeMB  int
	MaxBackups int
	MaxAgeDays int
	Compress   bool
}

// DefaultConfig returns a sensible default configuration
func DefaultConfig(logDir string) Config {
	return Config{
		LogDir:     logDir,
		MaxSizeMB:  10,
		MaxBackups: 5,
		MaxAgeDays: 30,
		Compress:   true,
	}
}

// New creates a new WailsLogger with the given configuration
func New(cfg Config) (*WailsLogger, *zerolog.Logger) {
	// Ensure log directory exists
	if err := os.MkdirAll(cfg.LogDir, 0755); err != nil {
		// Fallback to temp dir if we can't create the log dir
		cfg.LogDir = os.TempDir()
	}

	logPath := filepath.Join(cfg.LogDir, "app.log")

	// Configure lumberjack for log rotation
	fileWriter := &lumberjack.Logger{
		Filename:   logPath,
		MaxSize:    cfg.MaxSizeMB,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAgeDays,
		Compress:   cfg.Compress,
	}

	consoleWriter := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: "15:04:05",
	}
	writer := zerolog.MultiLevelWriter(consoleWriter, fileWriter)
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	logger := zerolog.New(writer).With().Timestamp().Logger()

	wl := &WailsLogger{
		logger:     logger,
		logDir:     cfg.LogDir,
		fileWriter: fileWriter,
	}

	// Set default level
	wl.level.Store(LevelInfo)

	// Set global logger for direct zerolog usage
	log.Logger = logger

	return wl, &logger
}

// GetLogger returns the underlying zerolog.Logger for structured logging
func (l *WailsLogger) GetLogger() *zerolog.Logger {
	return &l.logger
}

// GetLogDir returns the log directory path
func (l *WailsLogger) GetLogDir() string {
	return l.logDir
}

// SetLevel sets the logging level at runtime
func (l *WailsLogger) SetLevel(level LogLevel) {
	l.level.Store(level)

	switch level {
	case LevelDebug:
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	case LevelInfo:
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	case LevelWarn:
		zerolog.SetGlobalLevel(zerolog.WarnLevel)
	case LevelError:
		zerolog.SetGlobalLevel(zerolog.ErrorLevel)
	case LevelFatal:
		zerolog.SetGlobalLevel(zerolog.FatalLevel)
	}
}

// GetLevel returns the current logging level
func (l *WailsLogger) GetLevel() LogLevel {
	if v := l.level.Load(); v != nil {
		return v.(LogLevel)
	}
	return LevelInfo
}

// Close closes the file writer
func (l *WailsLogger) Close() error {
	if l.fileWriter != nil {
		return l.fileWriter.Close()
	}
	return nil
}

// --- Wails Logger Interface Implementation ---

// Print implements logger.Logger
func (l *WailsLogger) Print(message string) {
	l.logger.Info().Str("source", "wails").Msg(message)
}

// Trace implements logger.Logger
func (l *WailsLogger) Trace(message string) {
	l.logger.Trace().Str("source", "wails").Msg(message)
}

// Debug implements logger.Logger
func (l *WailsLogger) Debug(message string) {
	l.logger.Debug().Str("source", "wails").Msg(message)
}

// Info implements logger.Logger
func (l *WailsLogger) Info(message string) {
	l.logger.Info().Str("source", "wails").Msg(message)
}

// Warning implements logger.Logger
func (l *WailsLogger) Warning(message string) {
	l.logger.Warn().Str("source", "wails").Msg(message)
}

// Error implements logger.Logger
func (l *WailsLogger) Error(message string) {
	l.logger.Error().Str("source", "wails").Msg(message)
}

// Fatal implements logger.Logger
func (l *WailsLogger) Fatal(message string) {
	l.logger.Fatal().Str("source", "wails").Msg(message)
}

// --- Structured Logging Methods (for frontend calls) ---

// LogWithContext logs a message with module and context
func (l *WailsLogger) LogWithContext(level, module, message string, context map[string]any) {
	event := l.selectLogEvent(level)
	if event == nil {
		return
	}

	event = event.Str("module", module).Str("source", "frontend")

	// Add all context fields
	for key, value := range context {
		event = event.Interface(key, value)
	}

	event.Msg(message)
}

// LogBatch logs multiple entries at once (for frontend batch logging)
func (l *WailsLogger) LogBatch(entries []LogEntry) {
	for _, entry := range entries {
		l.LogWithContext(entry.Level, entry.Module, entry.Message, entry.Context)
	}
}

// selectLogEvent returns the appropriate zerolog event based on level string
func (l *WailsLogger) selectLogEvent(level string) *zerolog.Event {
	switch LogLevel(level) {
	case LevelDebug:
		return l.logger.Debug()
	case LevelInfo:
		return l.logger.Info()
	case LevelWarn:
		return l.logger.Warn()
	case LevelError:
		return l.logger.Error()
	case LevelFatal:
		return l.logger.Error() // Use Error instead of Fatal to avoid os.Exit
	default:
		return l.logger.Info()
	}
}
