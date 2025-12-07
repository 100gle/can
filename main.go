package main

import (
	"embed"

	"can/internal/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	application := app.New()
	application.InitSystemTray()

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
		Menu:             app.CreateApplicationMenu(application),
		OnStartup:        application.Startup,
		OnDomReady:       application.DomReady,
		OnBeforeClose:    application.BeforeClose,
		OnShutdown:       application.Shutdown,
		Bind: []any{
			application,
		},
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
			},
		},
		// Windows-specific options
		Windows: &windows.Options{
			Theme: windows.SystemDefault,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
