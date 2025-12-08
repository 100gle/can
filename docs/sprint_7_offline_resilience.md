# Sprint 7: 离线能力与可靠性提升 (Offline Resilience)

**目标**: 让 CAN 在网络抖动或完全离线时仍能工作，符合 `docs/features.md` 第 9.2 节和 `docs/spec/performance_optimization.md` / `docs/spec/transfer_management.md` 中关于“离线任务队列、自动恢复、离线缓存”的承诺。

## 1. 网络状态检测与 UI 提示
*   **功能描述**: 在前端建立统一的 Network 状态源（`useNetworkStatus` Hook + Zustand Store），监听 `online/offline` 事件；当 `navigator.onLine === false` 或 ping 失败时，向顶部 Banner/Toast 广播离线状态。
*   **关键任务**:
    *   检测：实现 `useNetworkStatus`，支持浏览器事件和周期性 HEAD 请求双重验证，暴露 `isOnline`, `lastChecked`, `reason`。
    *   存储：在 `frontend/src/state/session.ts` 或新建 `appStatusStore` 中保存网络状态，供 `objectsStore` / `transfersStore` 读取。
    *   通知：`DashboardLayout` 顶部加入离线 Banner，`transfers-page` 在列表上方显示 “离线暂停 · Offline paused” 提示，并在 `sonner` Toast 给出切换结果。
    *   Wails 侧：在 `internal/app/system.go` 暴露 `PingEndpoint`，为前端定期调用准备。

## 2. 离线任务排队与自动同步
*   **功能描述**: 当网络不可用时，上传、删除、重命名等操作不直接失败，而是写入本地离线队列（IndexedDB/SQLite Lite table），网络恢复后自动冲刷，满足 `docs/spec/performance_optimization.md` “离线队列”要求。
*   **关键任务**:
    *   队列模型：定义 `QueuedAction { id, accountId, bucket, type, payload, createdAt, retries }`，实现持久化（浏览器用 IndexedDB，Wails 用 SQLite 或本地 JSON）。
    *   接入点：在 `frontend/src/state/objects.ts` 的 `uploadFromPath`、`deleteObject`、`moveObjects` 等方法中，若检测离线则写入队列并立即给出 toast；在线则照常执行。
    *   同步器：编写 `offlineSyncWorker`（Web Worker 或 `setInterval`），监听网络恢复事件，按 FIFO 取出待办请求，调用原 API，失败则指数退避重试，超限后标记为失败。
    *   UI：在 `transfers-page` 增加 “离线待办” tab / drawer，展示排队项、失败原因、允许用户手动重试或取消。
    *   后端：在 `internal/objects/service.go` 提供幂等请求 ID（通过 `client.RequestID`）以避免重复执行。

## 3. 离线缓存与预览
*   **功能描述**: 根据 `docs/spec/performance_optimization.md` 的“离线缓存”章节，为最近访问的 Bucket / Object 列表、文件预览元数据提供缓存，离线时可浏览只读数据。
*   **关键任务**:
    *   缓存策略：为 `objectsStore.refresh` 和 `bucketsStore.list` 增加 Cache 层（LRU，配置 TTL），离线时直接返回缓存。
    *   预览：`file-preview-modal` 若无法拉取实时内容，回退到离线缓存（文本/Markdown 可存储最近版本；图片生成 base64 快照）。
    *   设置项：在 Settings → 性能卡片添加 “离线缓存” 开关、缓存大小 (10/50/100/500MB) 及清理按钮；落库到 `usePreferencesStore`。
    *   指示：在对象列表展示 “离线缓存 · Last sync at …” badge，提醒数据可能不是最新。

## 4. 自动恢复与冲突处理
*   **功能描述**: 让传输服务在网络恢复后自动继续，必要时提示冲突/过期；满足 `docs/spec/transfer_management.md` §10 对“网络恢复后自动恢复”的描述。
*   **关键任务**:
    *   传输层：扩展 `internal/transfer/service.go` 以监听 `networkStatus` 事件（可由前端通过 `EventsEmit("app:network", status)` 通知），在 `PauseAll` / `ResumePending` 间切换。
    *   冲突策略：若对象在离线期间发生版本变化，UI 弹出冲突对话框（提供覆盖/放弃/另存），并记录在离线日志。
    *   审计：在 `internal/security/service` 内为所有离线回放操作标记来源（`origin=offline-queue`），便于追踪。
    *   Telemetry：在 `transfers-page` 新增“离线暂停次数”“恢复成功次数”指标。

## 验收标准
- 离线断网后，UI 立即出现 Banner，上传/删除操作进入队列并在网络恢复后自动执行。
- 队列内容在应用重启后仍存在，可单独查看、取消、重试。
- 对象浏览器和预览在无网时仍能显示最后一次缓存，并标注时间戳。
- 传输任务在断网时自动暂停，无须用户干预即可恢复；冲突时给出明确提示。
- 所有新设置（缓存大小、队列开关等）都有单元测试 + e2e 用例覆盖。*** End Patch
