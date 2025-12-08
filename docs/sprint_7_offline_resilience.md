# Sprint 7: 离线能力与可靠性提升 (Offline Resilience)

**目标**: 让 CAN 在网络抖动或完全离线时仍能工作，符合 `docs/features.md` 第 9.2 节和 `docs/spec/performance_optimization.md` / `docs/spec/transfer_management.md` 中关于“离线任务队列、自动恢复、离线缓存”的承诺。

## 1. 网络状态检测与 UI 提示
*   **功能描述**: 在前端建立统一的 Network 状态源（`useNetworkStatus` Hook + Zustand Store），监听 `online/offline` 事件；当 `navigator.onLine === false` 或 ping 失败时，向顶部 Banner/Toast 广播离线状态。
*   **关键任务**:
    *   [x] 检测：实现 `useNetworkStatus`，支持浏览器事件和周期性 HEAD 请求双重验证，暴露 `isOnline`, `lastChecked`, `reason`。
    *   [x] 存储：在 `frontend/src/state/session.ts` 或新建 `appStatusStore` 中保存网络状态，供 `objectsStore` / `transfersStore` 读取。
    *   [x] 通知：`DashboardLayout` 顶部加入离线 Banner，`transfers-page` 在列表上方显示 “离线暂停 · Offline paused” 提示，并在 `sonner` Toast 给出切换结果。
    *   [x] Wails 侧：在 `internal/app/system.go` 暴露 `PingEndpoint`，为前端定期调用准备。

## 2. 离线任务排队与自动同步
*   **功能描述**: 当网络不可用时，上传、删除、重命名等操作不直接失败，而是写入本地离线队列（IndexedDB/SQLite Lite table），网络恢复后自动冲刷，满足 `docs/spec/performance_optimization.md` “离线队列”要求。
*   **关键任务**:
    *   [x] 队列模型：定义 `QueuedAction { id, accountId, bucket, type, payload, createdAt, retries, status, lastAttemptAt, lastError, versionToken }`，实现持久化（浏览器用 IndexedDB，Wails 用 SQLite 或本地 JSON）。`status` 遵循 `pending → retrying → completed|failed|canceled` 状态机，`versionToken` 存储对象的 `etag/hash` 以便冲突检测。
    *   [x] 接入点：在 `frontend/src/state/objects.ts` 的 `uploadFromPath`、`deleteObject`、`moveObjects` 等方法中，若检测离线则写入队列并立即给出 toast；在线则照常执行。账号切换、注销或 token 失效时触发隔离流程：提示用户选择“转移到新账号”“保留但暂停”“立即清空”。
    *   [x] 同步器：编写 `offlineSyncWorker`（Web Worker 或 `setInterval`），监听网络恢复事件并确认当前登录账号与队列项的 `accountId` 一致，按 FIFO 取出待办请求，调用原 API，失败则指数退避重试，超限后标记为失败并保留 `lastError`；容量超限或 TTL 过期的项记录在审计日志后丢弃。
    *   [x] UI：在 `transfers-page` 增加 “离线待办” tab / drawer，展示排队项、失败原因、允许用户手动重试或取消，并显示队列大小/容量阈值告警。
    *   [x] 后端：在 `internal/objects/service.go` 提供幂等请求 ID（通过 `client.RequestID`）以避免重复执行。

## 3. 离线缓存与预览
*   **功能描述**: 根据 `docs/spec/performance_optimization.md` 的“离线缓存”章节，为最近访问的 Bucket / Object 列表、文件预览元数据提供缓存，离线时可浏览只读数据。
*   **关键任务**:
    *   [x] 缓存策略：为 `objectsStore.refresh` 和 `bucketsStore.list` 增加 Cache 层（LRU，配置 TTL），离线时直接返回缓存；缓存条目保存 `lastSyncedAt`, `etag/hash`, `size` 等元数据，以在恢复阶段进行版本比对。
    *   [x] 预览：`file-preview-modal` 若无法拉取实时内容，回退到离线缓存（文本/Markdown 可存储最近版本；图片生成 base64 快照），并在 UI 展示缓存版本号与生成时间。
    *   [x] 设置项：在 Settings → 性能卡片添加 “离线缓存” 开关、缓存大小 (10/50/100/500MB) 及清理按钮；落库到 `usePreferencesStore`。
    *   [x] 指示：在对象列表展示 “离线缓存 · Last sync at …” badge，提醒数据可能不是最新。

## 4. 自动恢复与冲突处理
*   **功能描述**: 让传输服务在网络恢复后自动继续，必要时提示冲突/过期；满足 `docs/spec/transfer_management.md` §10 对“网络恢复后自动恢复”的描述。
*   **关键任务**:
    *   [x] 传输层：扩展 `internal/transfer/service.go` 以监听 `networkStatus` 事件（可由前端通过 `EventsEmit("app:network", status)` 通知），在 `PauseAll` / `ResumePending` 间切换，同时在恢复前刷取远端元数据并对比缓存中的 `versionToken`。
    *   [x] 冲突策略：若对象在离线期间发生版本变化或哈希不匹配，UI 弹出冲突对话框（提供覆盖/放弃/另存），决议结果写回队列项 `status`、传输任务记录，并同步到 `offline_conflicts` 审计表。
    *   [x] 审计：在 `internal/security/service` 内为所有离线回放操作标记来源（`origin=offline-queue`），附带 `requestId`, `accountId`, `resolution` 字段，便于追踪和复盘。
    *   [x] Telemetry：在 `transfers-page` 与诊断日志中新增“离线暂停次数”“恢复成功次数”“冲突数量”“队列丢弃/清空次数”等指标，并通过 `telemetry.emit("offline_replay", payload)` 定期上报。

## 验收标准
- 离线断网后，UI 立即出现 Banner，上传/删除操作进入队列并在网络恢复后自动执行；账号切换时会提示如何处置旧队列且不会跨账号误执行。
- 队列内容在应用重启后仍存在，可单独查看、取消、重试，展示最近错误与重试时间，并在容量或 TTL 触发时有告警。
- 对象浏览器和预览在无网时仍能显示最后一次缓存，包含版本戳与提示语，恢复后依据 `etag/hash` 进行冲突检测。
- 传输任务在断网时自动暂停，无须用户干预即可恢复；冲突/失败会记录在 `offline_conflicts` 与审计日志中并允许用户决议。
- 所有新设置（缓存大小、队列开关、容量上限）以及 Telemetry/队列状态机均有单元测试 + e2e 用例覆盖（包括离线→入队→恢复、账号切换、容量超限、冲突决议等场景）。
