package app

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// DomReady is called after the frontend resources have been loaded.
// Use this hook for operations that require the window to be ready.
func (a *App) DomReady(ctx context.Context) {
	// Log application ready state
	runtime.LogInfo(ctx, "Frontend DOM ready")
}

// BeforeClose intercepts window close attempts. The window is hidden instead of quitting
// unless the user explicitly confirmed an exit request.
func (a *App) BeforeClose(ctx context.Context) (prevent bool) {
	if a.quitRequested {
		return false
	}
	a.hideWindow(ctx)
	return true
}

// Shutdown is called when the application is about to terminate.
// Use this hook for cleanup operations.
func (a *App) Shutdown(ctx context.Context) {
	runtime.LogInfo(ctx, "Application shutting down...")

	// Close transfer queue and wait for workers to finish
	if a.transfers != nil {
		runtime.LogInfo(ctx, "Closing transfer service...")
		a.transfers.Close()
	}

	runtime.LogInfo(ctx, "Shutdown complete")
}

// ForceQuit allows the frontend to force quit after user confirmation.
func (a *App) ForceQuit() {
	a.requestQuit(true)
}

// OnSecondInstance is called when a second instance of the app is launched.
// It brings the existing window to the front.
func (a *App) OnSecondInstance(data options.SecondInstanceData) {
	runtime.WindowUnminimise(a.ctx)
	runtime.Show(a.ctx)
}

func (a *App) requestQuit(force bool) {
	ctx := a.ctx
	if ctx == nil {
		return
	}
	if !force && !a.confirmQuit(ctx) {
		return
	}
	a.quitRequested = true
	runtime.Quit(ctx)
}

func (a *App) confirmQuit(ctx context.Context) bool {
	activeTransfers := a.activeTransferCount(ctx)
	message := "确定要退出 CAN 吗？"
	if activeTransfers > 0 {
		message = fmt.Sprintf("仍有 %d 个传输任务运行，退出将终止它们，确定继续？", activeTransfers)
	}
	dialog, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "确认退出 CAN",
		Message:       message,
		Buttons:       []string{"取消", "确认退出"},
		DefaultButton: "确认退出",
		CancelButton:  "取消",
	})
	if err != nil {
		runtime.LogWarning(ctx, fmt.Sprintf("显示退出确认失败: %v", err))
		return false
	}
	return dialog == "确认退出"
}

func (a *App) activeTransferCount(ctx context.Context) int {
	if a.transfers == nil {
		return 0
	}
	count, err := a.transfers.CountActiveTasks(ctx)
	if err != nil {
		runtime.LogWarning(ctx, fmt.Sprintf("获取传输任务数量失败: %v", err))
		return 0
	}
	return count
}

func (a *App) hideWindow(ctx context.Context) {
	if ctx == nil {
		ctx = a.ctx
	}
	if ctx == nil {
		return
	}
	runtime.WindowMinimise(ctx)
	runtime.WindowHide(ctx)
	runtime.Hide(ctx)
}

func (a *App) showWindow() {
	ctx := a.ctx
	if ctx == nil {
		return
	}
	a.quitRequested = false
	runtime.WindowUnminimise(ctx)
	runtime.WindowShow(ctx)
	runtime.Show(ctx)
}

func (a *App) minimizeToTray() {
	a.hideWindow(nil)
}
