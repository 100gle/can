# I18N 覆核记录

## 背景
- 前端入口 `frontend/src/main.tsx` 会在渲染前加载 `./i18n/config`，确保 i18n 在 React 生命周期外完成初始化。
- `frontend/src/i18n/config.ts` 结合 `i18next`, `i18next-browser-languagedetector`, `i18next-resources-to-backend`, `react-i18next`：
  - `resourcesToBackend` 以 `../locales/<language>.json` 进行动态导入；
  - 默认回退语言为 `en`，`import.meta.env.DEV` 时开启 `debug` 便于抓取 missing key；
  - `escapeValue: false`，遵循 React 默认转义逻辑。
- 当前可用语言：`en`, `zh`，资源位于 `frontend/src/locales/en.json` 与 `frontend/src/locales/zh.json`。
- 语言切换入口：`frontend/src/components/language-switcher.tsx`，在全局 UI（侧边栏工具条）中提供下拉菜单。

## 运行与检查提示
1. 静态巡检：`cd frontend && rg -n "t(" src` 定位 `t` 用法；`rg -n '"[^"]*[\u4e00-\u9fa5]' src` 捕捉硬编码中文；`rg -n "'[^']*[A-Za-z]" src` 帮助搜寻未国际化英文字符串。
2. 运行期验证：`cd frontend && npm run dev`，在浏览器 DevTools 中观察 i18next `debug` 输出，确认不存在 missing key；如需记录日志，可暂时在 `i18n.init` 中打开 `saveMissing` 并指向后端或自定义处理。
3. 资源比对：使用 `jq` 或自定义脚本导出 `Object.keys`，确保 `en.json` 与 `zh.json` 结构匹配；必要时通过 `node -e "console.log(Object.keys(require('./src/locales/en.json')));"` 进行快速对照。

## 核查基线
- [x] React Entrypoint（`frontend/src/main.tsx`）：入口在挂载前加载 `./i18n/config`，确保 i18n 在 React 生命周期外初始化，无需后续动作。
- [x] i18n 配置（`frontend/src/i18n/config.ts`）：已启用 `resourcesToBackend` + `LanguageDetector`，`fallbackLng = 'en'` 且 DEV 环境下开启 `debug`，无需调整。
- [x] Locale 资源（`frontend/src/locales/en.json`, `frontend/src/locales/zh.json`）：已通过脚本逐键比对，key 完全一致，无缺失翻译。

## 组件级待办（Todo List）
状态约定：
- `[ ]` = Pending（尚未阅读）
- `[x]` = Done（已阅读且确认无硬编码）
- `[!]` = Needs Fix（已阅读但发现问题，需按备注处理）

### components（根目录）
- [x] LanguageSwitcher（`frontend/src/components/language-switcher.tsx`）：功能已迁移至设置页面 (`GeneralSettingsCard`)，已实现 i18n。

### components/dialogs
- [x] PasswordDialog（`frontend/src/components/dialogs/password-dialog.tsx`）：已检查，全部使用 locale。

### components/accounts
- [x] AccountFormDrawer（`frontend/src/components/accounts/account-form-drawer.tsx`）：确认 Drawer 标题、表单 label/placeholder、校验提示、提交按钮文本全部国际化。
- [x] AccountSelector（`frontend/src/components/accounts/account-selector.tsx`）：检查下拉选项、空态提示、搜索 placeholder。
- [x] AccountCardGrid（`frontend/src/components/accounts/account-card-grid.tsx`）：核对网格项状态文案与空态文字。
- [x] AccountStatusBadge（`frontend/src/components/accounts/account-status-badge.tsx`）：已使用 `t("account.status...")`。
- [x] AccountSwitcher（`frontend/src/components/accounts/account-switcher.tsx`）：检查标题、按钮、帮助文字。
- [x] AccountCard（`frontend/src/components/accounts/account-card.tsx`）：确认卡片字段标签、操作按钮、描述信息。
- [x] ConnectionTestButton（`frontend/src/components/accounts/connection-test-button.tsx`）：验证按钮文案、加载状态、测试结果提示是否国际化。

### components/layouts
- [x] PageHeader（`frontend/src/components/layouts/page-header.tsx`）：组件本身无硬编码，依赖 props。
- [x] DashboardBreadcrumb（`frontend/src/components/layouts/dashboard-breadcrumb.tsx`）：已修复硬编码中文 ("首页", "系统设置" 等)，现使用 `t()`。
- [x] DashboardLayout（`frontend/src/components/layouts/dashboard-layout.tsx`）：已修复硬编码 aria-label 和移动端提示，新增 `layout` 命名空间。
- [x] Sidebar（`frontend/src/components/layouts/sidebar.tsx`）：检查完毕，大部分已国际化，App Name保留英文。
- [x] HomeLayout（`frontend/src/components/layouts/home-layout.tsx`）：已修复硬编码标题 `home.title`。

### components/common
- [x] ProviderIcon（`frontend/src/components/common/provider-icon.tsx`）：Alt text 为英文，可接受。

### components/browser
- [x] BucketItem（`frontend/src/components/browser/bucket-item.tsx`）：上下文菜单改用 `contextMenu.enter/settings/delete`，新增 `contextMenu.settings` 文案。
- [x] TableFooterPaginator（`frontend/src/components/browser/table-footer-paginator.tsx`）：分页统计、按钮、页大小选择改用 `table.pagination.*` 文案。
- [x] BaseItem（`frontend/src/components/browser/base-item.tsx`）：组件仅渲染传入 label/overlay，无硬编码文案。
- [x] TableColumns（`frontend/src/components/browser/table-columns.tsx`）：列头 key、tooltip、排序提示已全部通过 `table.*`、`actions.*` 文案覆盖，无额外硬编码。
- [x] CheckboxCell（`frontend/src/components/browser/checkbox-cell.tsx`）：仅透传 ariaLabel props，无内置文本。
- [x] FileExplorer（`frontend/src/components/browser/file-explorer.tsx`）：加载/空态/工具栏/对话框均使用 `explorer.*`、`contextMenu.*` 等 key，error 文案来自 store。
- [x] BrowserToolbar（`frontend/src/components/browser/browser-toolbar.tsx`）：工具栏按钮/placeholder/提示均走 `toolbar.*` key。
- [x] CreateBucketDialog（`frontend/src/components/browser/create-bucket-dialog.tsx`）：引入 `bucket.create.*` key 覆盖表单/提示/错误与按钮文案。
- [x] TableRowContextMenu（`frontend/src/components/browser/table-row-context-menu.tsx`）：菜单项全部复用 `contextMenu.*` 文案。
- [x] TreeView（`frontend/src/components/browser/tree-view.tsx`）：空态/错误/菜单均走 `treeView.*` 与 `contextMenu.*` key。
- [x] FileTable（`frontend/src/components/browser/file-table.tsx`）：列头由 `table-columns` 控制，空态走 `table.noResults`。
- [x] FileItem（`frontend/src/components/browser/file-item.tsx`）：上下文菜单走 `contextMenu.*`，新增 `table.selectItem` 用于多选 aria。
- [x] SymlinkDialog（`frontend/src/components/browser/symlink-dialog.tsx`）：新增 `symlink.*` key 覆盖表单、提示、校验与 toast。
- [x] FileUtils（`frontend/src/components/browser/file-utils.tsx`）：移除硬编码 `zh-CN`，改用运行时 locale；函数本身无其他文案。

### components/search
- [x] SearchPanel（`frontend/src/components/search/search-panel.tsx`）：所有表单/按钮/结果文案统一走 `searchPanel.*` 命名空间，校验提示接入 i18n。

### components/objects
- [x] BatchAttributesDialog（`frontend/src/components/objects/batch-attributes-dialog.tsx`）：已检查，全部使用 `objects.batchAttributes.*` key 覆盖。
- [x] ExportFileListDialog（`frontend/src/components/objects/export-file-list-dialog.tsx`）：已覆盖标题与字段名，导出内容表头也使用 i18n label。
- [x] ObjectDetailsDrawer（`frontend/src/components/objects/object-details-drawer.tsx`）：基本详情、Key-Value 编辑、合规（对象锁/法律保留）均已 i18n。
- [x] FolderPicker（`frontend/src/components/objects/folder-picker.tsx`）：列表项、按钮、空态说明等文案已替换。
- [x] OfflineQueuePanel（`frontend/src/components/objects/offline-queue-panel.tsx`）：状态（PENDING/RUNNING/COMPLETED/FAILED）及操作按钮均已 i18n。
- [x] BatchToolbar（`frontend/src/components/objects/batch-toolbar.tsx`）：批量操作按钮文案（下载/属性/复制移动/导出/删除）及 Tooltip均已 i18n。
- [x] FilePreviewModal（`frontend/src/components/objects/file-preview-modal.tsx`）：标题、控制按钮、提示文本、错误信息均已 i18n。
- [x] MoveCopyDialog（`frontend/src/components/objects/move-copy-dialog.tsx`）：目标位置选择、按钮、警告文案、冲突策略说明均已 i18n。
- [x] DownloadOptionsDialog（`frontend/src/components/objects/download-options-dialog.tsx`）：选项标签、说明文字、按钮、警告信息均已 i18n。
- [x] RenameDialog（`frontend/src/components/objects/rename-dialog.tsx`）：输入提示、错误消息、按钮文字均已 i18n。
- [x] ObjectContextMenu（`frontend/src/components/objects/object-context-menu.tsx`）：菜单项、说明文本均已 i18n。
- [x] CreateFolderDialog（`frontend/src/components/objects/create-folder-dialog.tsx`）：表单 label、校验信息、按钮均已 i18n。

### components/transfer
- [x] UploadProgress（`frontend/src/components/transfer/upload-progress.tsx`）：进度描述、状态标签均已 i18n。
- [x] LinkHistoryPanel（`frontend/src/components/transfer/link-history-panel.tsx`）：列表标题、空态、操作按钮均已 i18n。
- [x] DropOverlay（`frontend/src/components/transfer/drop-overlay.tsx`）：拖拽提示、辅助文字均已 i18n。
- [x] SecurityTips（`frontend/src/components/transfer/security-tips.tsx`）：安全提示文案均已 i18n。
- [x] DownloadsPanel（`frontend/src/components/transfer/downloads-panel.tsx`）：表头、状态、按钮文案均已 i18n。
- [x] PresignedUrlDialog（`frontend/src/components/transfer/presigned-url-dialog.tsx`）：表单字段、链接说明均已 i18n。

### components/providers
- [x] AppEventsBridge（`frontend/src/components/providers/app-events-bridge.tsx`）：确认是否输出用户可见文案，如有需国际化。
- [x] UpdateChecker（`frontend/src/components/providers/update-checker.tsx`）：未找到文件，可能已移除。
- [x] ToasterProvider（`frontend/src/components/providers/toaster-provider.tsx`）：未找到文件，使用 Sonner 代替。
- [x] ThemeProvider（`frontend/src/components/providers/theme-provider.tsx`）：检查是否包含提示/描述 (无).

### components/settings
- [x] SessionSecurityCard（`frontend/src/components/settings/session-security-card.tsx`）：标题、说明、按钮均已 i18n。
- [x] AppearanceCard（`frontend/src/components/settings/appearance-card.tsx`）：已完成，使用 `settings.appearance.*` 和 `settings.theme.*`。
- [x] ThemeOptionButton（`frontend/src/components/settings/theme-option-button.tsx`）：已完成，aria-label 使用 i18n。
- [x] DataManagementCard（`frontend/src/components/settings/data-management-card.tsx`）：已完成，使用 `settings.data.*`。
- [x] AboutCard（`frontend/src/components/settings/about-card.tsx`）：已完成，使用 `settings.about.*`。
- [x] GeneralSettingsCard（`frontend/src/components/settings/general-settings-card.tsx`）：已移除/重构为独立 Card。
- [x] DataSecurityCard（`frontend/src/components/settings/data-security-card.tsx`）：警告、提示文案均已 i18n。
- [x] UpdatesCard（`frontend/src/components/settings/updates-card.tsx`）：已完成，使用 `system.update.*`。
- [x] SystemInformationCard（`frontend/src/components/settings/system-information-card.tsx`）：已完成，使用 `system.*` 和 `system.metrics.*`。
- [x] BackupCard（`frontend/src/components/settings/backup-card.tsx`）：已完成，使用 `settings.backup.*`。
- [x] OfflineCacheCard（`frontend/src/components/settings/offline-cache-card.tsx`）：已完成，使用 `settings.offline.*`。
- [x] TransferCacheCard（`frontend/src/components/settings/transfer-cache-card.tsx`）：已完成，使用 `settings.transfer.*` 和 `settings.offline.*`。
- [x] AdvancedSettingsCard（`frontend/src/components/settings/advanced-settings-card.tsx`）：已完成，使用 `settings.advanced.*`。

### components/ui
- [x] ContextMenu（`frontend/src/components/ui/context-menu.tsx`）：纯 UI 组件，无内置文本。
- [x] Skeleton（`frontend/src/components/ui/skeleton.tsx`）：纯 UI 组件。
- [x] Input（`frontend/src/components/ui/input.tsx`）：纯 UI 组件。
- [x] Textarea（`frontend/src/components/ui/textarea.tsx`）：纯 UI 组件。
- [x] Select（`frontend/src/components/ui/select.tsx`）：纯 UI 组件。
- [x] DropdownMenu（`frontend/src/components/ui/dropdown-menu.tsx`）：纯 UI 组件。
- [x] Collapsible（`frontend/src/components/ui/collapsible.tsx`）：纯 UI 组件。
- [x] Checkbox（`frontend/src/components/ui/checkbox.tsx`）：纯 UI 组件。
- [x] Button（`frontend/src/components/ui/button.tsx`）：纯 UI 组件。
- [x] Separator（`frontend/src/components/ui/separator.tsx`）：纯 UI 组件。
- [x] Table（`frontend/src/components/ui/table.tsx`）：纯 UI 组件。
- [x] Badge（`frontend/src/components/ui/badge.tsx`）：纯 UI 组件。
- [x] Dialog（`frontend/src/components/ui/dialog.tsx`）：已完成，使用 `actions.close`。
- [x] Command（`frontend/src/components/ui/command.tsx`）：已完成，使用 `ui.command.*`。
- [x] RadioGroup（`frontend/src/components/ui/radio-group.tsx`）：纯 UI 组件，无内置文本。
- [x] Breadcrumb（`frontend/src/components/ui/breadcrumb.tsx`）：已完成，使用 `actions.more`。
- [x] Switch（`frontend/src/components/ui/switch.tsx`）：纯 UI 组件，无内置文本。
- [x] Alert（`frontend/src/components/ui/alert.tsx`）：纯 UI 组件，标题描述由 children 传入。
- [x] Tooltip（`frontend/src/components/ui/tooltip.tsx`）：纯 UI 组件。
- [x] Sonner（`frontend/src/components/ui/sonner.tsx`）：Toast 组件，具体文本由调用方提供。
- [x] Label（`frontend/src/components/ui/label.tsx`）：纯 UI 组件。
- [x] Sheet（`frontend/src/components/ui/sheet.tsx`）：已完成，使用 `actions.close`。
- [x] KeyboardShortcutsHelp（`frontend/src/components/ui/keyboard-shortcuts-help.tsx`）：已完成，使用 `ui.shortcuts.*`。
- [x] Progress（`frontend/src/components/ui/progress.tsx`）：纯 UI 组件。
- [x] Popover（`frontend/src/components/ui/popover.tsx`）：纯 UI 组件。
- [x] Slider（`frontend/src/components/ui/slider.tsx`）：纯 UI 组件。
- [x] Card（`frontend/src/components/ui/card.tsx`）：纯 UI 组件。
- [x] Tabs（`frontend/src/components/ui/tabs.tsx`）：纯 UI 组件。
- [x] OfflineBanner（`frontend/src/components/ui/offline-banner.tsx`）：已完成，使用 `ui.offline.*`。
- [x] AlertDialog（`frontend/src/components/ui/alert-dialog.tsx`）：纯 UI 组件。

### components/buckets
- [x] SnapshotPanel（`frontend/src/components/buckets/snapshot-panel.tsx`）：已完成，使用 `bucket.snapshot.*`。
- [x] LifecyclePanel（`frontend/src/components/buckets/lifecycle-panel.tsx`）：已完成，使用 `bucket.lifecycle.*`。
- [x] EncryptionPanel（`frontend/src/components/buckets/encryption-panel.tsx`）：已完成，使用 `bucket.encryption.*`。
- [x] CapabilityGate（`frontend/src/components/buckets/capability-gate.tsx`）：受限提示信息。
- [x] BucketSettings（`frontend/src/components/buckets/bucket-settings.tsx`）：各设置项文案。
- [x] VersioningPanel（`frontend/src/components/buckets/versioning-panel.tsx`）：开关、说明。
- [x] RefererProtectionPanel（`frontend/src/components/buckets/referer-protection-panel.tsx`）：提示文字。
- [x] BlockPublicAccessPanel（`frontend/src/components/buckets/block-public-access-panel.tsx`）：警告、按钮。
- [x] PolicyPanel（`frontend/src/components/buckets/policy-panel.tsx`）：描述、列表文本。
- [x] WebsitePanel（`frontend/src/components/buckets/website-panel.tsx`）：字段、提示。
- [x] CorsPanel（`frontend/src/components/buckets/cors-panel.tsx`）：配置说明。
- [x] AccessControlPanel（`frontend/src/components/buckets/access-control-panel.tsx`）：权限说明、提示。

### pages
- [x] TransfersPage（`frontend/src/pages/transfers-page.tsx`）：已完成，使用 `transfers.*`。
- [x] BucketSettingsPage（`frontend/src/pages/bucket-settings-page.tsx`）：已完成，使用 `bucket.settings.page.*` 及各 Panel 对应的 title key。
- [x] SettingsPage（`frontend/src/pages/settings-page.tsx`）：已完成，使用 `settingsPage.*`。
- [x] HomePage（`frontend/src/pages/home-page.tsx`）：已完成，使用 `home.*`。
- [x] DashboardPage（`frontend/src/pages/dashboard-page.tsx`）：已完成，使用 `dashboard.*`。

### routes
- [x] RootRoute（`frontend/src/routes/__root.tsx`）：路由级布局文案（无硬编码）。
- [x] IndexRoute（`frontend/src/routes/index.tsx`）：重定向或说明文本（无硬编码）。
- [x] SettingsRoute（`frontend/src/routes/settings.tsx`）：标题描述（无硬编码）。
- [x] TransfersRoute（`frontend/src/routes/transfers.tsx`）：提示文案（无硬编码）。
- [x] AccountsRoute（`frontend/src/routes/accounts/$accountId.tsx`）：页面标题、错误提示已国际化。
- [x] AccountDashboardRoute（`frontend/src/routes/accounts/$accountId/dashboard.tsx`）：内容标题（无硬编码）。
- [x] AccountTransfersRoute（`frontend/src/routes/accounts/$accountId/transfers.tsx`）：列表、提示（无硬编码）。
- [x] BucketSettingsRoute（`frontend/src/routes/accounts/$accountId/buckets/$bucketId/settings.tsx`）：面包屑、标题、提示（无硬编码）。
