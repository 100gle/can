# Sprint 9: 自定义工作区与高级工具 (Personalization & Utilities)

**目标**: 交付 `docs/spec/utilities_tools.md`、`docs/spec/performance_optimization.md` 与 `docs/spec/ui_theme_localization.md` 尚未覆盖的“文件校验、分片调优、布局自定义 / 可访问性”能力，让资深用户可以按需调优体验。

## 1. 文件完整性校验工具
*   **功能描述**: 在 UI 中提供“哈希校验”面板，可计算本地/对象存储文件的 MD5/SHA256，并比对差异。
*   **关键任务**:
    *   计算器：前端实现 `useChecksumWorker`（Web Worker + `crypto.subtle`），支持大文件分块；Wails 端复用 `internal/transfer/checksum.go` 暴露 `ComputeObjectChecksum`.
    *   UI：在对象浏览器工具栏添加 “完整性校验”按钮，弹出对话框选择本地文件 + 云端对象，支持多文件队列与进度条。
    *   结果：展示表格（对象 Key、本地哈希、远端哈希、状态），允许导出 CSV/JSON。
    *   交互：校验完成后可将结果附加到操作日志，必要时触发通知。

## 2. 分片/并发/重试可配置
*   **功能描述**: 让用户自定义 multipart 大小、并发数、重试次数，满足 `docs/spec/performance_optimization.md` 的配置场景。
*   **关键任务**:
    *   偏好：在 `usePreferencesStore` 扩展 `transferTuning`（chunkSize, partConcurrency, retryCount, timeoutSeconds, offlineCacheSize）。
    *   设置页：新增 “传输性能” 卡片（Slider / Select），默认值沿用 5MB、并发 4、重试 3；提供预设说明。
    *   应用：`frontend/src/state/transfers.ts` 中的 `CHUNK_SIZE` 改为读取偏好，Upload Worker 根据 `partConcurrency` 并行上传；Go 端 `transfer.Service` 同步读取配置（通过 `App.GetTransferPreferences`）。
    *   验证：加入 `useValidation` 确保配置在安全范围内，保存后立即影响新任务；提供“恢复默认”按钮。

## 3. 布局自定义与可访问性
*   **功能描述**: 允许用户拖拽/收起侧边栏、保存对象浏览区域分栏宽度，并补齐屏幕阅读器/键盘支持，完成 `docs/spec/ui_theme_localization.md` 中的未完项。
*   **关键任务**:
    *   布局存储：在 `usePreferencesStore` 增加 `layoutPrefs { sidebarWidth, detailsDrawerPinned, defaultViewMode }`，持久化到 localStorage。
    *   组件改造：`DashboardLayout` 支持拖拽调整宽度，`objects/object-browser.tsx` 记住 Grid/List 默认视图，面包屑/操作栏根据偏好展开。
    *   可访问性：为关键交互元素添加 `aria-*`、`role`、`aria-live`；补齐键盘导航（Tab/Arrow）与 Focus 样式；编写 Playwright/Testing Library 用例验证。
    *   文档：在 `docs/spec/ui_theme_localization.md` “可访问性”小结更新状态，并在 Settings 提供“重置布局”按钮。

## 验收标准
- “完整性校验”对话框能成功计算本地与对象哈希、导出结果，并在离线/超时情况下给出提示。
- 用户可在设置里调整分片大小/并发/重试，并在下一次上传看到配置生效；提供清晰的默认值与说明。
- 侧边栏宽度、对象视图模式等个性化设定会在重启后保持，可通过按钮重置。
- 键盘 + 屏幕阅读器操作能完整访问对象浏览器、对话框和菜单（通过 axe/Playwright 检测），并补充测试。
- 所有新增功能有对应的 docs/README 更新以及前后端测试覆盖。*** End Patch
