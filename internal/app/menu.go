package app

import (
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// CreateApplicationMenu builds the native application menu for Mac/Windows.
// Mac: Full menu bar with App, File, Edit, Window menus.
// Windows: Simplified menu structure.
func CreateApplicationMenu(a *App) *menu.Menu {
	appMenu := menu.NewMenu()

	// App Menu
	canMenu := appMenu.AddSubmenu("CAN")
	canMenu.AddText("关于 CAN / About", nil, func(_ *menu.CallbackData) {
		if a.ctx == nil {
			return
		}
		_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.InfoDialog,
			Title:   "CAN Object Studio",
			Message: "S3 兼容对象存储管理工具\nCAN Object Studio",
		})
	})
	canMenu.AddSeparator()
	canMenu.AddText("显示窗口", keys.CmdOrCtrl("0"), func(_ *menu.CallbackData) {
		a.showWindow()
	})
	canMenu.AddText("隐藏窗口", keys.CmdOrCtrl("h"), func(_ *menu.CallbackData) {
		a.minimizeToTray()
	})
	canMenu.AddSeparator()
	canMenu.AddText("退出 CAN", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		a.requestQuit(false)
	})

	// File Menu
	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("隐藏到后台", keys.CmdOrCtrl("w"), func(_ *menu.CallbackData) {
		a.minimizeToTray()
	})

	// Edit Menu (standard edit operations for input fields)
	appMenu.Append(menu.EditMenu())

	// Window Menu
	windowMenu := appMenu.AddSubmenu("Window")
	windowMenu.AddText("显示", nil, func(_ *menu.CallbackData) {
		a.showWindow()
	})
	windowMenu.AddText("Minimize", keys.CmdOrCtrl("m"), func(_ *menu.CallbackData) {
		a.minimizeToTray()
	})
	windowMenu.AddText("Zoom", nil, func(_ *menu.CallbackData) {
		if a.ctx == nil {
			return
		}
		runtime.WindowToggleMaximise(a.ctx)
	})
	windowMenu.AddSeparator()
	windowMenu.AddText("Bring All to Front", nil, func(_ *menu.CallbackData) {
		a.showWindow()
	})

	helpMenu := appMenu.AddSubmenu("Help")
	helpMenu.AddText("帮助与支持", nil, func(_ *menu.CallbackData) {
		if a.ctx == nil {
			return
		}
		runtime.BrowserOpenURL(a.ctx, "https://github.com/100gle/can#readme")
	})

	return appMenu
}
