# Sprint 12: 前端架构重构 (续)

## 目标

继续完成前端架构重构工作，解决代码审计中发现的架构层级混淆、数据访问路径不统一、单体组件过于庞大等问题。

**Sprint 12 聚焦**：
- 完成剩余的服务层实现
- 重构 FileExplorer "上帝组件"
- 消除所有 window.alert，统一使用 Toast
- 建立前端分层规范和测试

## 背景

Sprint 11 的代码审计揭示了前端的核心问题：
- **FileExplorer** 是 991 行的"上帝组件"，混合状态、UI、副作用
- 部分组件直接调用 Wails API，绕过 store 和 offline manager
- 存在 29 处 `window.alert`，用户体验不一致
- 初始化逻辑分散，轮询未清理

**已完成 (Sprint 11)**:
- ✅ 创建统一服务层 (types, base, toast, bucket, transfer, backup)
- ✅ 迁移 SnapshotPanel 和 LinkHistoryPanel 到服务层

## Sprint 12 任务

### Task 1: 完成服务层实现

#### 1.1 对象服务
- [ ] 创建 `src/lib/services/object.ts`
  - `listObjects(accountId, input)` - 列出对象
  - `getObject(accountId, bucket, key)` - 获取对象信息
  - `deleteObject(accountId, bucket, key)` - 删除对象
  - `copyObject(accountId, srcBucket, srcKey, dstBucket, dstKey)` - 复制对象
  - `getPresignedDownloadURL(...)` - 生成下载链接
  - `getPresignedUploadURL(...)` - 生成上传链接

#### 1.2 账户服务
- [ ] 创建 `src/lib/services/account.ts`
  - `exportAccounts()` - 导出账户 (带 Toast)
  - `importAccounts()` - 导入账户 (带 Toast)
  - `bootstrap()` - 初始化账户列表
  - `validateConnection(accountId)` - 验证连接

### Task 2: 重构 FileExplorer 组件

#### 2.1 抽离 Hooks
- [ ] 创建 `src/hooks/useFileBrowserController.ts`
  - 管理 bucket/object 状态从 Zustand stores 读取
  - 处理导航: `goToRoot()`, `goToBucket()`, `enterFolder()`
  - 管理视图模式: `viewMode`, `setViewMode()`
  - 暴露: `{ buckets, objects, viewMode, navigation }`

- [ ] 创建 `src/hooks/useFileBrowserActions.ts`
  - 文件操作: `handleDownload()`, `handleDelete()`, `handleUpload()`
  - 批量操作: `handleBatchDelete()`, `handleBatchDownload()`
  - 刷新逻辑: `handleRefresh()`
  - 暴露: `{ download, delete, upload, refresh }`

#### 2.2 拆分 UI 组件
- [ ] 重构 `FileExplorer` (目标: <400 行)
  - 仅保留布局编排和对话框状态
  - 使用 hooks 获取数据和操作函数
  - 组合子组件

- [ ] 创建 `BrowserToolbar` 组件
  - Props: `viewMode`, `onViewModeChange`, `onRefresh`
  - 包含: 视图切换按钮、搜索框、刷新按钮

- [ ] 创建 `BrowserActionPanel` 组件
  - Props: `selectedItems`, `onBatchAction`
  - 包含: 批量操作按钮

#### 2.3 优化状态管理
- [ ] 审查 `bucketsStore` - 确保暴露清晰的 selectors
- [ ] 审查 `objectsStore` - 优化选择状态管理
- [ ] 移除 FileExplorer 中的直接 Wails API 调用

### Task 3: 统一交互反馈 - 消除 window.alert

#### 3.1 settings-page.tsx (15 处)
- [ ] 替换备份相关 alert (第 245, 255, 265, 279 行)
  - 迁移到 `backupService.createBackup/restoreBackup`
- [ ] 替换账户导入/导出 alert (第 296, 307, 330 行)
  - 迁移到 `accountService.exportAccounts/importAccounts`
- [ ] 替换缓存清除 alert (第 349 行)
- [ ] 处理密码相关逻辑 (修复 PasswordDialog 缺失问题)

#### 3.2 home-page.tsx (6 处)
- [ ] 替换账户导入/导出 alert (第 34, 45, 66 行)
  - 改用 `showSuccess()` 和 `showError()`

#### 3.3 其他组件 (8 处)
- [ ] `download-options-dialog.tsx` (第 81 行)
- [ ] `password-dialog.tsx` (第 41, 45 行)
- [ ] `transfers.ts` (第 212, 256 行)
- [ ] `downloads-panel.tsx` (第 53 行)
- [ ] `search-panel.tsx` (第 134 行)
- [ ] `access-control-panel.tsx` (第 102, 116, 120, 124 行)

### Task 4: 建立前端分层规范

#### 4.1 定义架构规则
- [ ] 创建 `docs/frontend_architecture.md`
  - 服务层职责: Wails 适配、错误处理、缓存
  - Store 职责: 状态管理、离线策略
  - 组件职责: 纯展示、用户交互

#### 4.2 代码审查清单
- [ ] 创建 `.github/PULL_REQUEST_TEMPLATE.md`
  - 检查点: "组件是否直接调用 Wails API?"
  - 检查点: "是否使用 Toast 而非 window.alert?"
  - 检查点: "是否通过 service/store 访问数据?"

### Task 5: 补充测试

#### 5.1 服务层单测
- [ ] 测试 `bucketService` - 快照、配置获取
- [ ] 测试 `transferService` - 链接历史
- [ ] 测试 `BackupService` - 备份/恢复
- [ ] Mock Wails API，测试 isBridgeAvailable 分支

#### 5.2 Hooks 单测
- [ ] 测试 `useFileBrowserController` - 导航、视图切换
- [ ] 测试 `useFileBrowserActions` - 文件操作

#### 5.3 集成测试
- [ ] 桌面模式: `wails dev` - 验证所有功能
- [ ] 浏览器模式: `pnpm dev` - 验证降级逻辑  
- [ ] 运行 `pnpm --dir frontend test` 和 `pnpm --dir frontend lint`

## 验收标准

### 代码质量
- [ ] 前端项目通过 `pnpm build` 构建
- [ ] 无 TypeScript 编译错误
- [ ] 无 oxlint 错误
- [ ] 所有 29 处 `window.alert` 已替换

### 架构质量
- [ ] FileExplorer 组件 < 400 行
- [ ] 所有组件通过 service/store 访问数据
- [ ] 服务层测试覆盖率 > 80%

### 用户体验
- [ ] 所有操作提供一致的 Toast 反馈
- [ ] 错误提示用户友好
- [ ] 桌面/浏览器模式降级正常

## 风险与依赖

### 风险
- FileExplorer 重构可能影响核心功能，需充分测试
- Toast 多行文本显示可能需要 CSS 调整

### 依赖
- 依赖 Sprint 11 完成的服务层基础设施
- 需要 Wails API 稳定 (无 breaking changes)

## 时间估算

- Task 1 (服务层): 1 天
- Task 2 (FileExplorer): 2-3 天
- Task 3 (window.alert): 1 天
- Task 4 (规范文档): 0.5 天
- Task 5 (测试): 1-2 天

**总计**: 5.5 - 7.5 天

## 参考资料

- [前端重构实施计划](file://../.gemini/antigravity/brain/106186f6-97c4-48a7-925d-b297058524d2/implementation_plan.md)
- [Sprint 11 Walkthrough](file://../.gemini/antigravity/brain/106186f6-97c4-48a7-925d-b297058524d2/walkthrough.md)
- [代码审计报告](../docs/sprint_11_refactoring.md)
