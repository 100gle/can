package app

import (
	"sync"

	_ "embed"

	"github.com/getlantern/systray"
)

//go:embed assets/tray_icon.png
var trayIconAsset []byte

const windowVisibilityEvent = "app:window-visibility"

type systemTray struct {
	app          *App
	showItem     *systray.MenuItem
	hideItem     *systray.MenuItem
	exitItem     *systray.MenuItem
	stopCh       chan struct{}
	stopOnce     sync.Once
	shutdownOnce sync.Once
}

func newSystemTray(appInstance *App) *systemTray {
	return &systemTray{
		app:    appInstance,
		stopCh: make(chan struct{}),
	}
}

func (s *systemTray) onReady() {
	if len(trayIconAsset) > 0 {
		systray.SetTemplateIcon(trayIconAsset, trayIconAsset)
	}
	systray.SetTitle("CAN")
	systray.SetTooltip("CAN · 对象存储客户端")

	s.showItem = systray.AddMenuItem("显示 CAN", "Show CAN window")
	s.hideItem = systray.AddMenuItem("隐藏到后台", "Hide window but keep transfers running")
	systray.AddSeparator()
	s.exitItem = systray.AddMenuItem("退出 CAN", "Quit CAN after confirmation")

	s.UpdateWindowState(s.app.windowVisible.Load())
	go s.listen()
}

func (s *systemTray) onExit() {
	s.stopOnce.Do(func() {
		close(s.stopCh)
	})
}

func (s *systemTray) listen() {
	for {
		select {
		case <-s.showItem.ClickedCh:
			s.app.showWindow()
		case <-s.hideItem.ClickedCh:
			s.app.minimizeToTray()
		case <-s.exitItem.ClickedCh:
			s.app.requestQuit(false)
		case <-s.stopCh:
			return
		}
	}
}

func (s *systemTray) UpdateWindowState(visible bool) {
	if s.showItem == nil || s.hideItem == nil {
		return
	}
	if visible {
		s.showItem.Disable()
		s.hideItem.Enable()
	} else {
		s.showItem.Enable()
		s.hideItem.Disable()
	}
}

func (s *systemTray) Shutdown() {
	s.shutdownOnce.Do(func() {
		systray.Quit()
	})
}

func (a *App) InitSystemTray() {
	if a.tray != nil {
		return
	}
	a.tray = newSystemTray(a)
	systray.Register(a.tray.onReady, a.tray.onExit)
}
