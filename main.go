package main

import (
	"embed"
	"os"
	"path/filepath"

	"can/internal/app"
	"can/internal/logger"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var icon []byte

func main() {
	// Initialize logger
	logDir := resolveLogDir()

	wailsLogger, _ := logger.New(logger.Config{
		LogDir:     logDir,
		MaxSizeMB:  10,
		MaxBackups: 5,
		MaxAgeDays: 30,
		Compress:   true,
	})

	// Set logger for app package to use
	app.SetLogger(wailsLogger)

	// Create an instance of the app structure
	application := app.New()

	// Create application with options
	err := wails.Run(&options.App{
		Title:     "CAN",
		Width:     1920,
		Height:    1080,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},

		OnStartup:     application.Startup,
		OnDomReady:    application.DomReady,
		OnBeforeClose: application.BeforeClose,
		OnShutdown:    application.Shutdown,
		Bind: []any{
			application,
		},
		// Use our custom logger for Wails internal logs
		Logger: wailsLogger,
		// Single Instance Lock - prevent multiple instances
		SingleInstanceLock: &options.SingleInstanceLock{
			UniqueId:               "com.can.s3-manager",
			OnSecondInstanceLaunch: application.OnSecondInstance,
		},
		// Enable drag and drop for file uploads
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop: true,
		},
		// Mac-specific options
		Mac: &mac.Options{
			TitleBar:   mac.TitleBarDefault(),
			Appearance: mac.DefaultAppearance, // Follow system dark/light mode
			About: &mac.AboutInfo{
				Title:   "CAN",
				Message: "S3 Compatible Object Storage Manager\n© 2025",
				Icon:    icon,
			},
		},
		// Windows-specific options
		Windows: &windows.Options{
			Theme: windows.SystemDefault,
		},
		Linux: &linux.Options{
			Icon: icon,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

// resolveLogDir returns the log directory path
func resolveLogDir() string {
	dir, err := os.UserConfigDir()
	if err != nil || dir == "" {
		dir = os.TempDir()
	}
	logDir := filepath.Join(dir, "can", "logs")
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return os.TempDir()
	}
	return logDir
}
