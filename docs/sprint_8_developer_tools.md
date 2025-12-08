# Sprint 8: 开发者诊断中心 (Developer Diagnostics)

**目标**: 兑现 `docs/features.md` 8.2 小节和 `docs/spec/developer_tools.md` 中的“API 请求日志、调试模式、代码生成”能力，帮助用户定位问题与复制配置。

## 1. API 请求日志中心
*   **功能描述**: 捕获 App 调用各 Provider SDK 时的 Request/Response，集中展示并支持搜索导出。
*   **关键任务**:
    *   中间件：在 `internal/providers/storage_factory.go` 封装 `RoundTripper`/`middleware stack`，记录 Method、Bucket/Key、Status、Duration、RequestID；持久化到 `internal/security` 或新建 `internal/devtools/logstore`（SQLite + TTL 1000 条）。
    *   API：在 `internal/app/system.go` 暴露 `ListApiLogs(filter)`、`ClearApiLogs()`，支持按账户、状态码、时间范围查询。
    *   前端：新增 `frontend/src/routes/developer.tsx` + `pages/developer-tools-page.tsx`，包括表格、筛选器（状态码、多选账户、时间段）、详情 Drawer（展示 Headers/Body）。
    *   导出：提供 CSV/JSON 导出按钮，复用 `lib/csv.ts`。
    *   权限：默认仅管理员可见（在设置页开启“开发者模式”后显示路由）。

## 2. 调试模式与可观察性
*   **功能描述**: 允许用户在设置里开启“调试模式”，输出更详细的日志，并暴露状态检查工具。
*   **关键任务**:
    *   偏好：在 `usePreferencesStore` 中新增 `developerMode`、`logVerbosity`，Settings → “开发者选项”卡片提供开关。
    *   Console 输出：当 `developerMode` 为 true 时，在前端统一通过 `devLogger` 打印 store 状态变更、Router 事件、Wails 调用耗时；可通过 `localStorage.setItem("CAN_DEBUG","true")` 强制。
    *   后端：`internal/app/app.go` 根据 `developerMode` 开启 `wails.Options.LogLevel = DEBUG`，并把 API 请求日志也输出到文件（`~/Library/Logs/CAN/dev.log`）。
    *   自检工具：在 Developer 页面新增“环境体检”卡片（显示当前版本、平台、Bridge 状态、数据库驱动），并提供一键复制 JSON。

## 3. 配置导出为代码片段
*   **功能描述**: 读取当前账户配置，把 Endpoint/AK/SK/Region 等数据生成通用 S3 代码示例（Python boto3、Node.js AWS SDK v3、Go aws-sdk-go-v2），满足 `docs/spec/developer_tools.md` “代码示例”条目。
*   **关键任务**:
    *   模板：创建 `internal/devtools/snippets` 包，使用 `text/template` + 内嵌模板文件；在前端暴露 `GenerateSnippet(accountID, language, recipe)`。
    *   UI：Developer 页面添加 “Code Snippets” 区，提供语言下拉（Python/Node/Go）、场景选择（初始化、列桶、上传、下载），展示语法高亮 + Copy 按钮。
    *   安全：默认脱敏 Secret（显示 `***`），需要用户勾选“包含凭证”后再解密；操作应写入审计日志。
    *   测试：为模板生成结果写单测（比较黄金文件），前端使用 Vitest 校验 UI 显示。

## 验收标准
- 新增 `/developer` 路由在启用开发者模式后可见，展示日志、体检和代码片段三大模块。
- API 日志支持分页、搜索和导出，最多保留 1000 条，超出会按时间淘汰。
- 调试模式可通过设置或 LocalStorage 打开，能看到详细的 console 输出和后台 `dev.log` 文件。
- 代码片段生成支持 Python/Node/Go 三种语言，能正确替换 Endpoint/Region，并通过复制按钮粘贴。
- 新增功能附带 README/Sprint 记录、Go 单测和前端 Vitest，确保回归通过。*** End Patch
