# 前端架构重构实施计划

## 实施进度

> 最后更新: 2025-12-09

| Phase | 内容 | 状态 |
|-------|------|------|
| **1** | 建立统一的 API 服务层 | ✅ 已完成 |
| **2** | 重构 FileExplorer 组件 | 🔲 待完成 |
| **3** | 重构直接调用 Wails API 的组件 | ✅ 已完成 |
| **4** | 集中化状态初始化与路由管理 | ✅ 已完成 |
| **5** | 移除 window.alert | ✅ 已完成 |
| **6** | 服务层在 Stores 中的集成 | ✅ 已完成 |

---

## 问题概述

基于专业审计专家的代码库审查,前端存在严重的架构层级混淆、数据访问路径不统一、单体组件过于庞大等问题,导致可维护性和扩展性受限。

### 核心问题汇总

1. **"上帝组件"问题** - `FileExplorer` 991 行,混合状态管理、UI渲染、副作用处理
2. **数据访问层不统一** - 部分组件直接调用 Wails API,绕过 Zustand store 和 offline manager
3. **初始化逻辑分散** - `bootstrap()` 和 `startPolling()` 在多处调用,缺少清理机制
4. **交互反馈混乱** - 29 处 `window.alert` 与 Sonner/Toast 混用

## 实施策略

采用**渐进式重构**策略,以 `FileExplorer` 和 `SnapshotPanel` 作为试点,验证分层架构的可行性后再推广到其他组件。

---

## Phase 1: 建立统一的 API 服务层

### 目标

创建 `src/lib/services/` 目录,封装所有 Wails API 调用,提供统一的错误处理、缓存策略和 offline 支持。

### 详细变更

#### [NEW] [types.ts](file:///Users/macbookpro/Repos/can/frontend/src/lib/services/types.ts)

定义服务层通用类型和接口:

```typescript
// 统一的服务响应类型
export type ServiceResult<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

// 统一的 Toast 配置
export interface ToastConfig {
  success?: string;
  error?: string;
  loading?: string;
}
```

#### [NEW] [base.ts](file:///Users/macbookpro/Repos/can/frontend/src/lib/services/base.ts)

实现基础服务类,自动处理桌面/Web 模式检测和错误反馈:

```typescript
export abstract class BaseService {
  protected async callWithToast<T>(
    apiCall: () => Promise<T>,
    config: ToastConfig
  ): Promise<ServiceResult<T>> {
    // 1. 检查 isBridgeAvailable()
    // 2. 显示 loading toast
    // 3. 调用 API 并捕获错误
    // 4. 显示成功/失败 toast
  }
}
```

#### [NEW] [bucket.ts](file:///Users/macbookpro/Repos/can/frontend/src/lib/services/bucket.ts)

封装所有 Bucket 相关 API (快照、版本控制、加密、策略、CORS):

```typescript
class BucketService extends BaseService {
  // 快照管理
  async createSnapshot(accountId: string, bucketId: string)
  async listSnapshots(accountId: string, bucketId: string)
  async deleteSnapshot(snapshotId: string)
  
  // 配置管理
  async getVersioning(...)
  async getEncryption(...)
  // ...
}

export const bucketService = new BucketService();
```

#### [NEW] [transfer.ts](file:///Users/macbookpro/Repos/can/frontend/src/lib/services/transfer.ts)

封装分享链接和传输历史管理:

```typescript
class TransferService extends BaseService {
  async listAccessLinkHistory(accountId: string, limit: number)
  async deleteAccessLinkHistory(accountId: string, id: string)
  async createAccessLink(...)
}
```

#### [NEW] [account.ts](file:///Users/macbookpro/Repos/can/frontend/src/lib/services/account.ts)

封装账户导入/导出逻辑:

```typescript
class AccountService extends BaseService {
  async exportAccounts(): Promise<ExportSummary>
  async importAccounts(): Promise<ImportSummary>
}
```

#### [NEW] [backup.ts](file:///Users/macbookpro/Repos/can/frontend/src/lib/services/backup.ts)

封装应用备份和恢复功能:

```typescript
class BackupService extends BaseService {
  async createBackup()
  async restoreBackup()
  async createEncryptedBackup(password: string)
  async restoreEncryptedBackup(password: string)
}
```

---

#### [NEW] [toast.ts](file:///Users/macbookpro/Repos/can/frontend/src/lib/toast.ts)

创建统一的 Toast 辅助函数:

```typescript
import { toast } from "sonner";

export function useToast() {
  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast.info(message),
    warning: (message: string) => toast.warning(message),
    loading: (message: string) => toast.loading(message),
  };
}

// 便捷函数
export const showSuccess = (msg: string) => toast.success(msg);
export const showError = (msg: string) => toast.error(msg);
```

---

## Phase 2: 重构"上帝组件" - FileExplorer

### 目标

将 991 行的 `FileExplorer` 拆分为职责单一的组件和 hooks,降低复杂度,提高可测试性。

### 详细变更

#### [NEW] [useFileBrowserController.ts](file:///Users/macbookpro/Repos/can/frontend/src/hooks/useFileBrowserController.ts)

抽离核心状态管理和导航逻辑:

```typescript
export function useFileBrowserController(accountId?: string) {
  // 从 store 读取状态
  const buckets = useBucketsStore((s) => s.buckets);
  const objects = useObjectsStore((s) => s.objects);
  
  // 导航逻辑
  const goToRoot = () => { ... };
  const goToBucket = (bucketName: string) => { ... };
  const enterFolder = (key: string) => { ... };
  
  // 视图模式管理
  const [viewMode, setViewMode] = useState<"list" | "grid" | "tree">("grid");
  
  return {
    // 状态
    buckets, objects, viewMode,
    // 操作
    goToRoot, goToBucket, enterFolder, setViewMode,
  };
}
```

#### [NEW] [useFileBrowserActions.ts](file:///Users/macbookpro/Repos/can/frontend/src/hooks/useFileBrowserActions.ts)

抽离文件操作逻辑:

```typescript
export function useFileBrowserActions() {
  const handleDownload = (key: string) => { ... };
  const handleDelete = () => { ... };
  const handleUpload = (files: File[]) => { ... };
  const handleRefresh = () => { ... };
  
  return {
    handleDownload,
    handleDelete,
    handleUpload,
    handleRefresh,
  };
}
```

#### [MODIFY] [file-explorer.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/file-explorer.tsx)

大幅简化主组件,仅保留布局和组件编排:

- 删除内部状态管理逻辑,改用 `useFileBrowserController` 和 `useFileBrowserActions`
- 移除直接的 Wails API 调用,改用服务层
- 保留对话框状态管理 (这部分 UI 相关)

预计从 991 行缩减到约 300-400 行。

#### [NEW] [browser-toolbar.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/browser-toolbar.tsx)

抽离顶部工具条(视图切换、搜索、刷新):

```typescript
export function BrowserToolbar({
  viewMode,
  onViewModeChange,
  onRefresh,
}: BrowserToolbarProps) {
  return <div>...</div>;
}
```

---

## Phase 3: 重构直接调用 Wails API 的组件

### 目标

将 `SnapshotPanel` 和 `LinkHistoryPanel` 改为使用服务层,统一错误处理和 Toast 反馈。

### 详细变更

#### [MODIFY] [snapshot-panel.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/buckets/snapshot-panel.tsx)

- 删除第 24-27 行的直接导入 `CreateBucketSnapshot`, `DeleteBucketSnapshot`, `ListBucketSnapshots`
- 改为导入 `import { bucketService } from "@/lib/services/bucket"`
- 修改 `loadSnapshots` 使用 `bucketService.listSnapshots()`
- 修改 `handleCreateSnapshot` 使用 `bucketService.createSnapshot()`
- 修改 `confirmDelete` 使用 `bucketService.deleteSnapshot()`
- 移除手动的 `console.error`,改用服务层统一的 Toast 反馈

#### [MODIFY] [link-history-panel.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/transfer/link-history-panel.tsx)

- 删除第 4 行的 `DeleteAccessLinkHistory`, `ListAccessLinkHistory` 导入
- 改为 `import { transferService } from "@/lib/services/transfer"`
- 修改 `loadHistory` 和 `handleDelete` 使用服务层方法
- 取消注释第 53 行的 toast,或使用 `showSuccess()` 辅助函数

---

## Phase 4: 集中化状态初始化与路由管理

### 目标

在 TanStack Router 的 `beforeLoad` 和 `onLeave` 钩子中统一管理账户初始化和轮询生命周期,避免重复调用。

### 详细变更

#### [MODIFY] [__root.tsx](file:///Users/macbookpro/Repos/can/frontend/src/routes/__root.tsx)

在根路由添加全局初始化:

```typescript
export const Route = createRootRoute({
  beforeLoad: async () => {
    // 全局初始化 - 加载账户列表
    await accountsStore.bootstrap();
  },
  component: RootComponent,
});
```

#### [MODIFY] [index.tsx](file:///Users/macbookpro/Repos/can/frontend/src/routes/index.tsx)

删除第 6-8 行的重复 `beforeLoad: async () => { await accountsStore.bootstrap(); }`

#### [MODIFY] [$accountId.tsx](file:///Users/macbookpro/Repos/can/frontend/src/routes/accounts/$accountId.tsx)

- 删除第 13 行的 `await accountsStore.bootstrap()` (已在根路由执行)
- 在 `beforeLoad` 中保留账户验证和 `setActiveAccount` 逻辑
- 添加 `onLeave` 钩子停止轮询:

```typescript
export const Route = createFileRoute("/accounts/$accountId")({
  beforeLoad: async ({ params }) => {
    const state = accountsStore.getState();
    // ... 验证逻辑 ...
    await accountsStore.setActiveAccount(params.accountId);
    transfersStore.startPolling();
  },
  onLeave: () => {
    transfersStore.stopPolling();
  },
  component: AccountLayout,
});
```

- 在 `AccountLayout` 组件中删除第 56-64 行的 `useEffect` 逻辑 (已移到路由层)

#### [MODIFY] [home-page.tsx](file:///Users/macbookpro/Repos/can/frontend/src/pages/home-page.tsx)

删除第 22-24 行的 `useEffect(() => { void accountsStore.bootstrap(); }, []);`

---

## Phase 5: 统一交互反馈 - 移除 window.alert

### 目标

将所有 29 处 `window.alert` 替换为 `sonner` Toast 通知,提供非阻塞、一致的用户体验。

### 详细变更

#### [MODIFY] [home-page.tsx](file:///Users/macbookpro/Repos/can/frontend/src/pages/home-page.tsx)

替换 6 处 `window.alert`:

- 第 34 行: `window.alert?.("暂无可导出的账户")` → `showError("暂无可导出的账户"); return;`
- 第 45 行: `window.alert?.(lines.join("\n"))` → `showSuccess(lines.join("\n"))`
- 第 66 行: `window.alert?.(lines.join("\n"))` → 同上

#### [MODIFY] [settings-page.tsx](file:///Users/macbookpro/Repos/can/frontend/src/pages/settings-page.tsx)

替换 15 处 `window.alert`:

- 第 245, 255 行: 成功提示 → `showSuccess(...)`
- 第 248, 258, 272, 285 行: 失败提示 → `showError(...)`
- 第 283 行: 密码错误 → `showError("密码错误,请重试")`
- 第 296, 307, 330, 349 行: 其他提示 → 根据语义使用 `showSuccess` 或 `showError`

#### [MODIFY] 其他组件 (8 处)

- `download-options-dialog.tsx` (第 81 行)
- `password-dialog.tsx` (第 41, 45 行)
- `transfers.ts` (第 212, 256 行)
- `downloads-panel.tsx` (第 53 行)
- `search-panel.tsx` (第 134 行)
- `access-control-panel.tsx` (第 102, 116, 120, 124 行)

全部替换为 `showError` 或 `showWarning`。

> [!IMPORTANT]
> 在替换时需谨慎处理多行文本,`window.alert` 支持 `\n` 换行,而 `sonner` 默认不支持。需要:
> - 使用 `<br/>` 或将文本拆分为多条 toast
> - 或保留 `\n` 字符,依赖 CSS 的 `white-space: pre-line` 样式

---

## Phase 6: 服务层在 Stores 中的集成

### 目标

逐步将现有 Zustand stores 中的 Wails API 调用迁移到服务层,确保一致性。

### 详细变更

#### [MODIFY] [accounts.ts](file:///Users/macbookpro/Repos/can/frontend/src/state/accounts.ts)

- 第 465, 483 行的 `window.alert` → 使用 `accountService.exportAccounts()` 和 `accountService.importAccounts()` (已包含 Toast 反馈)

#### [MODIFY] 其他 stores (可选,根据优先级)

如果 `bucketsStore`, `objectsStore` 等也有直接调用 Wails API 的地方,考虑逐步迁移。但优先级低于 UI 组件层。

---

## 验证计划

### Automated Tests

#### 1. 单元测试 - 服务层

**测试文件**: 创建 `frontend/src/lib/services/__tests__/bucket.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { bucketService } from '../bucket';

describe('BucketService', () => {
  it('should handle snapshot creation', async () => {
    // Mock Wails API
    // 测试成功/失败场景
  });
});
```

**运行命令**: `pnpm --dir frontend test`

#### 2. 单元测试 - Hooks

**测试文件**: 创建 `frontend/src/hooks/__tests__/useFileBrowserController.test.ts`

使用 `@testing-library/react-hooks` 测试:
- 导航逻辑
- 视图模式切换
- 状态计算

**运行命令**: `pnpm --dir frontend test`

#### 3. Lint 验证

**运行命令**: `pnpm --dir frontend lint`

确保无 TypeScript 类型错误和 ESLint 规则违反。

---

### Manual Verification

#### 1. 桌面模式测试 (`wails dev`)

**测试步骤**:

1. 启动开发服务器: `wails dev`
2. 测试 FileExplorer 功能:
   - [ ] 切换视图模式 (list/grid/tree)
   - [ ] 进入/退出文件夹
   - [ ] 上传文件
   - [ ] 下载文件
   - [ ] 删除对象
3. 测试 SnapshotPanel:
   - [ ] 创建快照
   - [ ] 查看快照列表
   - [ ] 删除快照
   - [ ] 验证 Toast 提示正确显示
4. 测试账户导入/导出:
   - [ ] 导出账户
   - [ ] 导入账户
   - [ ] 验证不再有 `window.alert` 弹窗
5. 测试应用备份/恢复:
   - [ ] 创建备份
   - [ ] 恢复备份
   - [ ] 创建加密备份
   - [ ] 恢复加密备份
6. 测试传输管理:
   - [ ] 进入账户页面,验证轮询启动
   - [ ] 退出账户页面,验证轮询停止 (检查控制台无重复请求)

#### 2. 浏览器模式测试 (`pnpm --dir frontend dev`)

**测试步骤**:

1. 启动纯前端服务器: `pnpm --dir frontend dev`
2. 访问 `http://localhost:5173`
3. 验证降级功能:
   - [ ] 文件浏览器在无 Wails API 时不崩溃
   - [ ] Toast 提示正常工作
   - [ ] 服务层正确检测 `isBridgeAvailable()` 并返回友好错误

#### 3. 回归测试

在完成所有重构后,进行全流程测试:

1. [ ] 创建新账户
2. [ ] 浏览 Bucket 和对象
3. [ ] 上传/下载文件
4. [ ] 创建分享链接
5. [ ] 查看传输历史
6. [ ] 使用搜索功能
7. [ ] 修改偏好设置
8. [ ] 查看帮助文档

确保所有功能与重构前行为一致,且无 `window.alert` 残留。

---

## User Review Required

> [!WARNING]
> **破坏性变更**: 本次重构将大幅修改 `FileExplorer` 组件结构,虽然会保持外部 API 一致,但内部实现完全重写。需要充分测试以确保无回归问题。

> [!IMPORTANT]
> **测试策略**: 由于前端缺少完整的 E2E 测试覆盖,本次重构将严重依赖手动测试。建议在重构过程中保持频繁的增量验证,避免一次性修改过多代码。

> [!CAUTION]
> **Toast 多行文本问题**: `window.alert` 支持换行符 `\n`,但 `sonner` 默认不支持。需要确认 Toast 库的配置或选择替代方案 (如自定义 Toast 组件)。

---

## 备注

- **优先级**: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6
- **试点组件**: 优先重构 `FileExplorer` 和 `SnapshotPanel`,验证架构可行性
- **增量迁移**: 每个 Phase 完成后立即测试,确保功能正常再继续
- **文档更新**: 在重构完成后,更新前端架构文档和组件开发指南
