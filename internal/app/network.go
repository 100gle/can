package app

import (
	"context"
	"fmt"
	"strings"

	"can/internal/transfer"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const networkStatusEvent = "app:network"

type networkSignal struct {
	online bool
	reason string
}

func (a *App) subscribeNetworkEvents(ctx context.Context) {
	if ctx == nil || a.transfers == nil {
		return
	}
	if a.networkEventsCancel != nil {
		return
	}
	cancel := runtime.EventsOn(ctx, networkStatusEvent, func(data ...interface{}) {
		a.handleNetworkSignal(data...)
	})
	a.networkEventsCancel = cancel
}

func (a *App) handleNetworkSignal(payload ...interface{}) {
	signal, ok := parseNetworkSignal(payload...)
	if !ok {
		return
	}
	previous := a.networkOnline.Load()
	if signal.online == previous {
		return
	}
	a.networkOnline.Store(signal.online)
	if signal.online {
		a.resumeTransfersAfterNetwork(signal.reason)
	} else {
		a.pauseTransfersForNetwork(signal.reason)
	}
}

func parseNetworkSignal(args ...interface{}) (networkSignal, bool) {
	if len(args) == 0 {
		return networkSignal{}, false
	}
	switch value := args[0].(type) {
	case bool:
		return networkSignal{online: value}, true
	case string:
		switch strings.ToLower(value) {
		case "online":
			return networkSignal{online: true}, true
		case "offline":
			return networkSignal{online: false}, true
		default:
			return networkSignal{}, false
		}
	case map[string]interface{}:
		return decodeNetworkMap(value)
	default:
		return networkSignal{}, false
	}
}

func decodeNetworkMap(value map[string]interface{}) (networkSignal, bool) {
	var signal networkSignal
	if online, ok := extractBool(value, "online"); ok {
		signal.online = online
	} else if online, ok := extractBool(value, "isOnline"); ok {
		signal.online = online
	} else {
		return networkSignal{}, false
	}
	if reason, ok := value["reason"].(string); ok {
		signal.reason = reason
	} else if status, ok := value["status"].(string); ok {
		signal.reason = status
	}
	return signal, true
}

func extractBool(data map[string]interface{}, key string) (bool, bool) {
	raw, ok := data[key]
	if !ok {
		return false, false
	}
	switch v := raw.(type) {
	case bool:
		return v, true
	case string:
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "true", "1", "online", "up":
			return true, true
		case "false", "0", "offline", "down":
			return false, true
		}
	}
	return false, false
}

func (a *App) pauseTransfersForNetwork(reason string) {
	if a.transfers == nil {
		return
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	count, err := a.transfers.PauseAll(ctx, transfer.PauseReasonNetwork)
	if err != nil {
		a.logWarning(fmt.Sprintf("网络离线暂停传输失败: %v", err))
		return
	}
	if reason == "" {
		reason = "offline"
	}
	a.logInfo(fmt.Sprintf("检测到离线(%s)，已暂停 %d 个传输任务", reason, count))
}

func (a *App) resumeTransfersAfterNetwork(reason string) {
	if a.transfers == nil {
		return
	}
	ctx, cancel := a.backgroundContext()
	defer cancel()
	count, err := a.transfers.ResumePending(ctx, transfer.PauseReasonNetwork)
	if err != nil {
		a.logWarning(fmt.Sprintf("网络恢复时恢复传输失败: %v", err))
		return
	}
	if reason == "" {
		reason = "online"
	}
	a.logInfo(fmt.Sprintf("网络已恢复(%s)，已恢复 %d 个传输任务", reason, count))
}

func (a *App) logInfo(message string) {
	if a.ctx != nil {
		runtime.LogInfo(a.ctx, message)
	}
}

func (a *App) logWarning(message string) {
	if a.ctx != nil {
		runtime.LogWarning(a.ctx, message)
	}
}
