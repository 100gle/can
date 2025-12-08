# 前端重构任务清单

## Phase 1: 建立统一的 API 服务层 (Service Layer)

### 1.1 创建服务层基础架构
- [x] 创建 `src/lib/services/` 目录结构
- [x] 创建 `src/lib/services/types.ts` - 定义通用类型和错误处理接口
- [x] 创建 `src/lib/services/base.ts` - 实现基础服务类,封装 `isBridgeAvailable` 检查
- [x] 定义统一的错误处理策略和 loading 状态管理模式

### 1.2 实现各领域服务层
- [x] 创建 `src/lib/services/bucket.ts` - 封装所有 Bucket 相关 API
  - `CreateBucketSnapshot`, `ListBucketSnapshots`, `DeleteBucketSnapshot`
  - `GetBucketVersioning`, `GetBucketEncryption`, `GetBucketPolicy`, `GetBucketCORS`
  - 集成缓存策略和 offline 支持
- [ ] 创建 `src/lib/services/object.ts` - 封装所有对象操作 API
  - `ListObjects`, `GetObject`, `DeleteObject`, `CopyObject`
  - `GetPresignedDownloadURL`, `GetPresignedUploadURL`
- [x] 创建 `src/lib/services/transfer.ts` - 封装传输相关 API
  - `ListAccessLinkHistory`, `DeleteAccessLinkHistory`, `CreateAccessLink`
  - 统一分享链接管理逻辑
- [ ] 创建 `src/lib/services/account.ts` - 封装账户相关 API
  - 导入/导出账户逻辑
  - 账户初始化和验证
- [x] 创建 `src/lib/services/backup.ts` - 封装备份恢复 API
  - `CreateBackup`, `RestoreBackup`, `CreateEncryptedBackup`, `RestoreEncryptedBackup`

### 1.3 服务层错误处理和反馈
- [x] 创建 `src/lib/toast.ts` - 统一的 Toast 通知辅助函数
  - 实现 `useToast()` hook
  - 定义标准的成功/错误/警告/信息提示格式
- [x] 在服务层集成 Toast 反馈,替代 `console.error`
- [x] 建立统一的错误码和用户友好提示消息映射

## Phase 2: 重构"上帝组件" - FileExplorer

### 2.1 抽离视图模型 (ViewModel)
- [ ] 创建 `src/hooks/useFileBrowserController.ts`
  - 管理 bucket/object 状态
  - 处理导航逻辑 (进入文件夹、返回上级、跳转到根目录)
  - 管理视图模式切换 (list/grid/tree)
  - 统一使用 `bucketsStore` 和 `objectsStore` 的 selectors
- [ ] 创建 `src/hooks/useFileBrowserActions.ts`
  - 批量操作逻辑 (删除、下载、移动、复制)
  - 上传逻辑封装
  - 刷新和加载逻辑

### 2.2 拆分 UI 组件
- [ ] 重构 `FileExplorer` 主组件 - 仅保留布局和组件编排
- [ ] 拆分 `BrowserToolbar` 组件 - 顶部工具条(视图切换、搜索、刷新)
- [ ] 拆分 `BrowserActionPanel` 组件 - 批量操作面板
- [ ] 确保每个子组件职责单一,接收纯 props,不直接访问 store

### 2.3 优化状态管理
- [ ] 审查 `bucketsStore` 和 `objectsStore`,确保暴露清晰的 selectors
- [ ] 移除组件中的直接 Wails API 调用,统一通过服务层
- [ ] 优化选择状态管理,避免不必要的重渲染

## Phase 3: 重构直接调用 Wails API 的组件

### 3.1 使用服务层统一数据访问
- [x] 重构 `SnapshotPanel` 使用 `bucketService`
  - 删除直接的 Wails API 导入
  - 改用 `bucketService.listSnapshots/createSnapshot/deleteSnapshot`
  - 移除手动错误处理,使用服务层统一 Toast
- [x] 重构 `LinkHistoryPanel` 使用 `transferService`
  - 删除直接的 Wails API 导入
  - 改用 `transferService.listAccessLinkHistory/deleteAccessLinkHistory`
  - 启用 Toast 通知 (复制链接提示)
- [ ] 审查其他直接调用 Wails API 的组件,逐步迁移

## Phase 4: 统一交互反馈与 UX 规范

### 4.1 移除 window.alert
- [ ] 替换 `home-page.tsx` 中的 6 处 `window.alert` 为 Toast
- [ ] 替换 `settings-page.tsx` 中的 15 处 `window.alert` 为 Toast
- [ ] 替换其他组件中的 8 处 `window.alert` 为 Toast

### 4.2 建立 UI/服务分层规则
- [ ] 定义并文档化"展示组件不得直接触碰 Wails API"规则
- [ ] 审查所有组件,确保数据获取和副作用通过 store/service
- [ ] 在 `SnapshotPanel` 和 `LinkHistoryPanel` 中应用新规则

### 4.3 补充单元测试
- [ ] 为 `useFileBrowserController` 编写单测
- [ ] 为核心服务层函数编写单测
- [ ] 确保在 browser-only 模式下也能正常工作

## Phase 5: 验证与优化

### 5.1 测试验证
- [ ] 运行 `pnpm --dir frontend test` 确保测试通过
- [ ] 运行 `pnpm --dir frontend lint` 确保无 lint 错误
- [ ] 在桌面模式 (`wails dev`) 测试所有功能
- [ ] 在浏览器模式 (`pnpm dev`) 测试降级功能

### 5.2 文档更新
- [ ] 更新前端架构文档,说明分层职责
- [ ] 创建服务层 API 文档
- [ ] 更新组件开发指南

## Notes

- 优先级: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
- 可以先以 `FileExplorer` 和 `SnapshotPanel` 作为试点
- 每个 Phase 完成后都要进行集成测试
- 保持向后兼容,逐步迁移,避免大爆炸式重构
