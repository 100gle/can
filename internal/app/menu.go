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

	// Mac App Menu
	appMenu.Append(menu.AppMenu())

	// File Menu
	fileMenu := appMenu.AddSubmenu("File")
	fileMenu.AddText("Close Window", keys.CmdOrCtrl("w"), func(_ *menu.CallbackData) {
		runtime.WindowMinimise(a.ctx)
	})

	// Edit Menu (standard edit operations for input fields)
	appMenu.Append(menu.EditMenu())

	// Window Menu
	windowMenu := appMenu.AddSubmenu("Window")
	windowMenu.AddText("Minimize", keys.CmdOrCtrl("m"), func(_ *menu.CallbackData) {
		runtime.WindowMinimise(a.ctx)
	})
	windowMenu.AddText("Zoom", nil, func(_ *menu.CallbackData) {
		runtime.WindowToggleMaximise(a.ctx)
	})
	windowMenu.AddSeparator()
	windowMenu.AddText("Bring All to Front", nil, func(_ *menu.CallbackData) {
		runtime.WindowUnminimise(a.ctx)
		runtime.Show(a.ctx)
	})

	return appMenu
}
