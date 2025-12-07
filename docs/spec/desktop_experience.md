# 桌面端体验 (Desktop Experience)

## 1. 窗口管理 (Window Management)

### 1.1 关闭行为 (Close Behavior)
- **行为描述**：用户点击窗口左上角的关闭按钮（Mac红点/Windows X号）或使用快捷键 `Cmd/Ctrl+W` 时，应用**不应退出**，而是**隐藏主窗口**。
- **后台驻留**：应用进程保持运行，以确保后台上传/下载任务、同步任务不中断。
- **重新激活**：
  - 点击 Dock 图标 (Mac) 或 任务栏图标 (Windows) 应重新显示主窗口。
  - 再次运行应用（单实例检测）应唤起已有窗口。

### 1.2 退出行为 (Quit Behavior)
- **行为描述**：只有通过显式的退出操作才能完全终止应用进程。
- **触发方式**：
  - 菜单栏：`Can > Quit Can` (Mac) 或 `File > Exit` (Windows)。
  - 快捷键：`Cmd+Q` (Mac) 或 `Alt+F4` (Windows，视习惯而定，通常 Wails Windows 默认 Alt+F4 为退出，需拦截处理为隐藏或允许退出，建议统一为菜单退出)。
  - Dock/任务栏右键菜单退出。
- **退出拦截 (BeforeClose Hook)**：
  - 在应用退出前（`OnBeforeClose`），始终弹出确认对话框。
  - **确认内容**："确定要退出应用吗？"
  - **用户操作**：点击 "确认退出" 关闭应用，点击 "取消" 阻止退出。

## 2. 单实例锁定 (Single Instance Lock)

### 2.1 功能描述
- 确保同一时间操作系统中只能运行一个 CAN 应用实例，防止多个进程同时操作本地数据库 (`transfers.db`) 或配置文件导致数据损坏/冲突。

### 2.2 实现机制
- 使用 Wails 的 `SingleInstanceLock` 配置。
- **唯一标识**：定义一个固定的 UUID 作为应用唯一 ID。
- **冲突处理**：
  - 当用户尝试启动第二个实例时，检测到锁存在。
  - **动作**：第二个实例立即终止，并向第一个实例发送信号（或通过 Wails 回调机制）。
  - **响应**：第一个实例收到信号后，自动执行 `WindowUnminimise` 和 `WindowShow`，并前置窗口（Focus），提醒用户应用已在运行。

## 3. 原生菜单 (Native Menu)

### 3.1 菜单结构
- **Mac**:
  - **App Menu (`Can`)**: About, Check for Updates, Separator, Hide Can (Cmd+H), Hide Others, Show All, Separator, Quit Can (Cmd+Q).
  - **File**: New Window (可选), Close Window (Cmd+W).
  - **Edit**: Undo, Redo, Cut, Copy, Paste, Select All. (标准编辑功能，确保输入框可用)
  - **Window**: Minimize (Cmd+M), Zoom, Separator, Bring All to Front.
- **Windows**:
  - 简化菜单，或无顶部菜单（Modern UI 风格通常隐藏菜单栏），主要依赖窗口内导航。若保留菜单栏，应包含 `File > Exit`。

### 3.2 快捷键绑定
- **Cmd+Q**: 绑定到 `runtime.Quit`。
- **Cmd+W**: 绑定到 `runtime.WindowHide` (非 Quit)。
- **Cmd/Ctrl+C/V/X/A**: 绑定到标准编辑行为。

## 4. 平台特性配置 (Platform Specifics)

### 4.1 MacOS
- **TitleBarStyle**: `HiddenInset` 或 `Hidden`，实现自定义标题栏（无边框窗口风格），与应用现代化 UI 融合。
- **Appearance**: 跟随系统或强制 Dark Mode（视设计规范）。

### 4.2 Windows
- **Theme**: 适配 Windows 10/11 深色模式。
- **Backdrop**: 如支持，启用 Mica 或 Acrylic 效果（视 Wails 版本支持情况）。

## 5. 拖拽集成 (Drag & Drop Integration)

> 详见 `docs/spec/file_upload.md`，此处仅定义系统交互层。

- **系统能力**：启用 Wails `EnableFileDrop`。
- **交互**：
  - 用户从 Finder/Explorer 拖拽文件/文件夹进入应用窗口。
  - 应用前端全屏（或特定区域）显示 "Drop to Upload" 遮罩层。
  - 释放后，获取文件路径列表，触发前端上传模态框。
