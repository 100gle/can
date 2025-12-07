# Sprint 6: 帮助系统与细节打磨 (Help & Polish)

**目标**: 完善新手引导与特定云厂商的高级配置，打造完整的桌面应用体验。

## 1. 帮助与支持系统
*   **功能描述**: 为用户提供应用内的帮助文档、快捷键速查表和反馈入口。
*   **关联文档**: `docs/features.md` (Section 10)
*   **关键任务**:
    *   [x] 前端: 创建 `HelpPage`，包含 "快速入门", "常见问题", "快捷键列表"。
    *   [x] 前端: 集成 "问题反馈" 表单 (可以是 `mailto:` 链接或 GitHub Issues 链接)。
    *   [x] 内容: 编写基础的内置 Markdown 文档。

## 2. 增强型存储桶创建
*   **功能描述**: 优化创建存储桶的体验，支持云厂商特定的高级参数。
*   **关联文档**: `docs/features.md` (Item 56, 57)
*   **关键任务**:
    *   [x] UI: 重构 `CreateBucketDialog` 为多步骤或折叠式表单。
    *   [x] OSS: 添加 "存储类型" (标准/低频/归档) 选择。
    *   [x] COS: 添加 "多可用区 (MAZ)" 配置选项。

## 3. 桌面端原生集成优化
*   **功能描述**: 提升 Mac/Windows 桌面端的原生体验。
*   **关联文档**: `docs/features.md` (Section 8)
*   **关键任务**:
    *   [x] Wails: 优化系统托盘 (System Tray) 菜单 (显示/隐藏, 退出)。
    *   [x] Wails: 拦截窗口关闭事件 (Cmd+W)，实现 "最小化到托盘" 逻辑 (已部分实现，需优化交互)。
    *   [x] Wails: 实现退出确认 (Cmd+Q)，检查是否有正在进行的传输任务。

## 4. 全局细节打磨
*   **功能描述**: 收尾工作，确保 UI 一致性和软件质量。
*   **关键任务**:
    *   [x] 更新检查: 集成 GitHub Releases API 检查新版本。
    *   [x] i18n 完善: 确保所有新增界面都有完整的中英文翻译。
    *   [x] UI Review: 统一间距、字体和颜色，修复视觉 Bug。

## 验收记录（2025-12-07）
- ✅ 系统托盘与隐藏/显示：`internal/app/tray.go` + `internal/app/lifecycle.go` 组合提供统一的窗口可见性状态（`windowVisible` 原子 + `runtime.EventsEmit`），托盘项会随状态禁用/启用，`OnSecondInstance` 复用 `showWindow` 确保重新激活时同步 UI。
- ✅ 桌面事件回传：`frontend/src/components/providers/app-events-bridge.tsx` 通过 `EventsOn("app:window-visibility")` 监听托盘隐藏事件，仅在 Bridge 可用时订阅，并以 `sonner` Toast 向用户提示“隐藏到托盘”的入口。
- ✅ 对象合规管理：`frontend/src/components/objects/object-details-drawer.tsx` 新增“合规”页签，打通 `GetObjectLockConfiguration / GetObjectRetention / GetObjectLegalHold` 等 API（`internal/app/objects.go`、`internal/objects/service.go`、`internal/providers/*`），可设置 Governance/Compliance 模式、保留截止时间、Bypass Governance 及法律保留开关。
- 🔬 测试：`go test ./...`；`pnpm --dir frontend test`（Vitest，Settings 页依旧模拟 `GetSystemMetrics` 报警但场景受控）。
