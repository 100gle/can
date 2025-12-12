# React 优化指南

本文档详细分析了前端项目中 React 的使用情况，识别了潜在的优化点，包括 `useEffect` 的滥用、可派生状态的错误处理、以及缺失的性能优化措施。

---

## 目录

1. [概述](#概述)
2. [useEffect 滥用问题](#useeffect-滥用问题)
   - [可派生状态误用 useEffect](#可派生状态误用-useeffect)
   - [同步外部状态的 useEffect](#同步外部状态的-useeffect)
   - [表单状态重置的 useEffect](#表单状态重置的-useeffect)
3. [缺失的性能优化](#缺失的性能优化)
   - [缺少 useMemo 的计算密集型操作](#缺少-usememo-的计算密集型操作)
   - [缺少 useCallback 的回调函数](#缺少-usecallback-的回调函数)
   - [缺少 React.memo 的重渲染优化](#缺少-reactmemo-的重渲染优化)
4. [已有的良好实践](#已有的良好实践)
5. [优化建议汇总](#优化建议汇总)
6. [优先级排序](#优先级排序)

---

## 概述

经过对项目中 50+ 个 `useEffect` 使用点的分析，发现了以下几类问题：

| 问题类型 | 数量 | 严重程度 |
|---------|-----|---------|
| 可派生状态误用 | 5 | 中 |
| 表单/对话框状态重置 | 8 | 低 |
| 同步外部状态 | 3 | 中 |
| 数据加载（合理使用） | 20+ | ✅ 正确 |
| 事件监听/清理（合理使用） | 10+ | ✅ 正确 |

---

## useEffect 滥用问题

### 可派生状态误用 useEffect

这类问题指的是：某些值可以通过现有 props 或 state 直接计算得出，却使用了额外的 state + useEffect 来同步。

#### 问题 1: SpeedLimitDialog 对话框初始值同步

**文件**: [transfers-page.tsx](file:///Users/macbookpro/Repos/can/frontend/src/pages/transfers-page.tsx#L52-62)

```tsx
// ❌ 当前实现
const [limit, setLimit] = useState("");

useEffect(() => {
  if (open) {
    setLimit(globalSpeedLimit > 0 ? String(globalSpeedLimit) : "");
  }
}, [open, globalSpeedLimit]);
```

**问题**: 这里使用 `useEffect` 来同步 `limit` 状态，实际上可以简化。

**建议**:
```tsx
// ✅ 更好的实现：利用 Dialog 的受控 open 状态，在 open 变化时重置
const [limit, setLimit] = useState("");

// 方案1：使用 key 强制重新挂载
<Dialog key={open ? 'open' : 'closed'}>
  
// 方案2：保持 useEffect 但简化依赖（当前实现可接受，因为需要响应 open 变化）
```

**优先级**: 🟡 中 - 当前实现功能正确，但可以更简洁

---

#### 问题 2: SearchPanel 表单与 store query 同步

**文件**: [search-panel.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/search/search-panel.tsx#L114-116)

```tsx
// ❌ 当前实现
useEffect(() => {
  form.reset(query);
}, [query, form]);
```

**问题**: 每次 `query` 变化都会重置整个表单，可能导致用户输入丢失。

**建议**:
```tsx
// ✅ 更好的实现：使用 useMemo 派生初始值，或使用 useRef 跟踪是否需要同步
const initialValues = useMemo(() => query, [query.bucket, query.prefix]);

// 或者添加一个明确的标志来控制何时同步
const shouldSyncRef = useRef(true);
```

**修复状态**: ✅ 已在 `fix: guard search form reset sync` 中落地，`SearchPanel` 通过 `useRef` 追踪上次同步快照，仅在非派生字段发生实质变化时才执行 `form.reset`，避免 `offset` 更新时覆盖用户输入。

**优先级**: 🟡 中 - 可能影响用户体验

---

#### 问题 3: AccountFormDrawer 测试状态重置

**文件**: [account-form-drawer.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/accounts/account-form-drawer.tsx#L210-221)

```tsx
// ❌ 当前实现
useEffect(() => {
  setTestStatus("idle");
  setTestHint(undefined);
}, [
  formValues.accessKeyId,
  formValues.secretAccessKey,
  formValues.endpoint,
  // ... 更多依赖
]);
```

**问题**: 这个 effect 的目的是在表单字段变化时重置测试状态，但依赖过多且可能导致不必要的状态更新。

**建议**:
```tsx
// ✅ 更好的实现：在字段变化的处理函数中直接重置
const handleFieldChange = (field: string, value: string) => {
  form.setFieldValue(field, value);
  if (['accessKeyId', 'secretAccessKey', 'endpoint'].includes(field)) {
    setTestStatus("idle");
    setTestHint(undefined);
  }
};
```

**修复状态**: ✅ 已在 `fix: reset account test status on field change` 中完成，相关字段的 `onChange`/`onCheckedChange` 会直接调用 `resetTestStatus`，不再依赖包含 7 个字段的 effect。

**优先级**: 🟢 低 - 功能正确，但代码可以更清晰

---

#### 问题 4: FileTable 页码重置逻辑

**文件**: [file-table.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/file-table.tsx#L87-91)

```tsx
// ❌ 当前实现
useEffect(() => {
  if (!truncated && currentPage > totalPages) {
    setCurrentPage(totalPages);
  }
}, [currentPage, totalPages, truncated]);
```

**问题**: 这段逻辑可以直接在计算中处理，避免额外的 effect。

**建议**:
```tsx
// ✅ 更好的实现：直接使用派生值
const safePage = useMemo(() => {
  if (!truncated && currentPage > totalPages) {
    return totalPages;
  }
  return currentPage;
}, [currentPage, totalPages, truncated]);

// 注意：safePage 已经在第85行定义了，只需删除这个 useEffect
```

**修复状态**: ✅ 已在 `refactor: derive file table page clamp` 中完成，分页器与数据切片都改用 `safePage`，不再通过 effect 回写 `currentPage`。

**优先级**: 🟢 低 - 已有 safePage 计算，useEffect 可能冗余

---

### 同步外部状态的 useEffect

这类问题指的是：使用 useEffect 来同步不同状态管理系统之间的状态。

#### 问题 5: AccountLayout 激活账户同步

**文件**: [$accountId.tsx](file:///Users/macbookpro/Repos/can/frontend/src/routes/accounts/$accountId.tsx#L52-56)

```tsx
// 当前实现
useEffect(() => {
  if (activeAccountId !== accountId) {
    void accountsStore.setActiveAccount(accountId);
  }
}, [activeAccountId, accountId]);
```

**分析**: 这个 useEffect 的目的是在路由参数变化时更新 store 中的活动账户。这是一个合理的使用场景，因为路由是外部状态源。

**建议**: ✅ **保留** - 这是合理的使用，用于同步路由与应用状态

**优先级**: ✅ 正确使用

---

### 表单状态重置的 useEffect

这类模式在多个对话框组件中重复出现：

#### 问题 6: 对话框打开时重置状态模式

**受影响文件**:
- [account-form-drawer.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/accounts/account-form-drawer.tsx#L181-189)
- [rename-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/rename-dialog.tsx#L36-41)
- [move-copy-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/move-copy-dialog.tsx#L111-120)
- [create-bucket-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/create-bucket-dialog.tsx#L55-64)
- [file-preview-modal.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/file-preview-modal.tsx#L159-190)

```tsx
// 常见模式
useEffect(() => {
  if (open) {
    // 重置所有状态
    setField1(initialValue);
    setField2(initialValue);
    // ...
  }
}, [open, ...dependencies]);
```

**问题**: 这种模式虽然功能正确，但可以通过更好的组件设计来简化。

**建议**:
```tsx
// ✅ 方案1：使用 key prop 强制重新挂载
<Dialog key={dialogKey}>
  <DialogContent>
    <InnerDialogContent {...props} />
  </DialogContent>
</Dialog>

// ✅ 方案2：将状态提取到独立组件
function DialogContentInner({ onClose }: Props) {
  // 所有状态在组件挂载时初始化
  const [field, setField] = useState(initialValue);
  // ...
}

// 父组件中
{open && <DialogContentInner onClose={handleClose} />}
```

**优先级**: 🟢 低 - 当前模式功能正确，优化主要是代码可维护性

**修复状态**: ✅ 已在 `refactor: dialog conditional rendering` 中完成，`RenameDialog`、`CreateBucketDialog`、`MoveCopyDialog` 均已重构为条件渲染模式，内部 Content 组件仅在对话框打开时挂载，关闭后自动重置状态，不再需要 useEffect 进行状态同步。


---

## 缺失的性能优化

### 缺少 useMemo 的计算密集型操作

#### 问题 7: BucketSettingsPage sections 数组

**文件**: [bucket-settings-page.tsx](file:///Users/macbookpro/Repos/can/frontend/src/pages/bucket-settings-page.tsx#L104-191)

```tsx
// ❌ 当前实现：每次渲染都创建新数组
const sections: BucketSettingsSection[] = [
  {
    id: "acl",
    label: t("bucket.acl.title"),
    render: () => (
      <CapabilityGate capability={featureMatrix.acl}>
        <AccessControlPanel provider={account.provider} />
      </CapabilityGate>
    ),
  },
  // ... 更多 sections
];
```

**问题**: `sections` 数组在每次渲染时都会重新创建，包括其中的 render 函数。

**建议**:
```tsx
// ✅ 使用 useMemo
const sections = useMemo<BucketSettingsSection[]>(() => [
  {
    id: "acl",
    label: t("bucket.acl.title"),
    render: () => (
      <CapabilityGate capability={featureMatrix.acl}>
        <AccessControlPanel provider={account.provider} />
      </CapabilityGate>
    ),
  },
  // ...
], [t, featureMatrix, account?.provider]);
```

**修复状态**: ✅ 已在 `feat: memoize bucket settings sections` 中完成，`sections` 通过 `useMemo` 派生并依赖 `t`、`featureMatrix` 与 `account.provider`。

**优先级**: 🟡 中 - 可能导致子组件不必要的重渲染

---

#### 问题 8: ObjectDetailsDrawer entries 计算

**文件**: [object-details-drawer.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/object-details-drawer.tsx#L37)

```tsx
// 在 KeyValueEditor 中
const entries = Object.entries(data);
```

**分析**: 每次渲染都会重新计算 entries，但由于 `data` 是 props，且组件相对简单，这个问题影响较小。

**优先级**: 🟢 低

---

### 缺少 useCallback 的回调函数

#### 问题 9: FolderPicker 事件处理函数

**文件**: [folder-picker.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/folder-picker.tsx#L90-106)

```tsx
// ❌ 当前实现
const handleEnterFolder = (path: string) => {
  setCurrentPrefix(path);
};

const handleGoUp = () => {
  // ...
};

const handleConfirm = () => {
  // ...
};
```

**建议**:
```tsx
// ✅ 使用 useCallback
const handleEnterFolder = useCallback((path: string) => {
  setCurrentPrefix(path);
}, []);

const handleGoUp = useCallback(() => {
  if (!currentPrefix) return;
  const parts = currentPrefix.replace(/\/$/, "").split("/");
  parts.pop();
  const parent = parts.length > 0 ? parts.join("/") + "/" : "";
  setCurrentPrefix(parent);
}, [currentPrefix]);
```

**修复状态**: ✅ 已完成，`handleEnterFolder`、`handleGoUp`、`handleConfirm` 均已使用 `useCallback` 优化。

**优先级**: 🟢 低 - 组件较小，影响有限

---

#### 问题 10: TransfersPage 内联函数

**文件**: [transfers-page.tsx](file:///Users/macbookpro/Repos/can/frontend/src/pages/transfers-page.tsx#L143-148)

```tsx
// ❌ 当前实现：内联函数在每次渲染时创建
<Button onClick={() => transfersStore.clearCompleted()}>
  {t("transfers.clearCompleted")}
</Button>
```

**分析**: 对于简单的 store 调用，内联函数的影响较小。但如果组件频繁重渲染，可以考虑提取。

**建议**:
```tsx
// ✅ 可选优化
const handleClearCompleted = useCallback(() => {
  transfersStore.clearCompleted();
}, []);
```

**修复状态**: ✅ 已完成，`handleClearCompleted`、`handlePauseTask`、`handleResumeTask`、`handleCancelTask`、`handleDeleteTask` 均已使用 `useCallback` 优化，`taskList` 已使用 `useMemo` 缓存，`TaskRow` 已使用 `memo` 包装。

**优先级**: 🟢 低

---

### 缺少 React.memo 的重渲染优化

#### 问题 11: AccountCardGrid 子组件

**分析**: 项目中已经在关键组件如 `TreeNode`、`BucketItem` 等使用了 `memo`，这是好的实践。

**建议检查的组件**:
- [ ] `TransferTask` row 组件（如果存在）
- [ ] `SettingsItem` 组件
- [ ] 大列表中的 item 组件

**优先级**: 🟡 中 - 需要根据实际渲染性能决定

---

## 已有的良好实践

项目中已经有一些优秀的优化实践，值得保持和推广：

### ✅ TreeNode 的 memo 优化

**文件**: [tree-view.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/tree-view.tsx#L421-650)

```tsx
const TreeNode = memo(
  function TreeNodeInner(props: TreeNodeProps) {
    // ...
  },
  (prevProps, nextProps) => {
    // 自定义比较函数，精确控制重渲染
    return (
      prevProps.selected === nextProps.selected &&
      prevProps.node === nextProps.node &&
      // ...
    );
  },
);
```

### ✅ useFileBrowserController 的 useMemo 和 useCallback

**文件**: [useFileBrowserController.ts](file:///Users/macbookpro/Repos/can/frontend/src/hooks/useFileBrowserController.ts)

```tsx
// 良好的 useMemo 使用
const activeAccount = useMemo(
  () => accounts.find((account) => account.id === accountId),
  [accounts, accountId],
);

// 良好的 useCallback 使用
const goToRoot = useCallback(() => {
  setLevel("buckets");
  setCurrentBucket(null);
  // ...
}, []);
```

### ✅ FileTable 的 useRef + getter 模式

**文件**: [file-table.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/file-table.tsx#L100-168)

```tsx
// 使用 ref 保存最新数据，避免闭包陷阱
const paginatedDataRef = useRef(paginatedData);
paginatedDataRef.current = paginatedData;

// columns 使用 getter 函数访问最新数据
const columns = useMemo(
  () =>
    createFileTableColumns({
      getSelectedKeys: () => selectedKeysRef.current,
      getAllKeys: () => paginatedDataRef.current.map((d) => d.key),
      // ...
    }),
  [/* 只依赖回调函数 */],
);
```

### ✅ useCapabilities 的合理数据获取

**文件**: [useCapabilities.ts](file:///Users/macbookpro/Repos/can/frontend/src/hooks/useCapabilities.ts)

```tsx
useEffect(() => {
  if (!accountId || !isDesktopMode()) {
    setState({ capabilities: [], loading: false, error: null });
    return;
  }
  // 数据获取逻辑...
}, [accountId]);
```

---

## 优化建议汇总

### 高优先级 (建议立即修复)

| 问题 | 文件 | 优化方式 |
|-----|-----|---------|
| ✅ sections 数组已 memoize | bucket-settings-page.tsx | `useMemo` 包裹 sections（`feat: memoize bucket settings sections`） |
| ✅ SearchPanel query 同步已修复 | search-panel.tsx | 精细化 reset 判定 + 快照比较（`fix: guard search form reset sync`） |

### 中优先级 (建议在下次迭代中修复)

| 问题 | 文件 | 优化方式 |
|-----|-----|---------|
| SpeedLimitDialog 状态同步 | transfers-page.tsx | 考虑使用 key 或简化 |
| ✅ AccountFormDrawer 测试状态重置 | account-form-drawer.tsx | 字段 `onChange` 内联调用 `resetTestStatus`（`fix: reset account test status on field change`） |
| ✅ FileTable 页码重置 useEffect | file-table.tsx | 使用派生 `safePage` 取代 effect（`refactor: derive file table page clamp`） |

### 低优先级 (可选优化)

| 问题 | 文件 | 优化方式 |
|-----|-----|---------|
| ✅ FolderPicker 回调函数 | folder-picker.tsx | 已添加 useCallback |
| ✅ 对话框重置模式 | 多个文件 | 使用条件渲染模式（RenameDialog, CreateBucketDialog, MoveCopyDialog） |
| ✅ TransfersPage 内联函数 | transfers-page.tsx | 已提取为 useCallback + useMemo + memo |

---

## 优先级排序

### 1️⃣ 立即处理

```diff
// bucket-settings-page.tsx
- const sections: BucketSettingsSection[] = [
+ const sections = useMemo<BucketSettingsSection[]>(() => [
    // ...
- ];
+ ], [t, featureMatrix, account?.provider]);
```

- [x] 已完成：`feat: memoize bucket settings sections`

### 2️⃣ 短期处理

1. ✅ 审查 `search-panel.tsx` 中的表单同步逻辑（`fix: guard search form reset sync`）
2. 考虑为频繁渲染的列表项添加 `memo`
3. ✅ 清理 `file-table.tsx` 中的冗余 useEffect（`refactor: derive file table page clamp`）

### 3️⃣ 长期改进

1. 建立项目级的 ESLint 规则，检测 useEffect 滥用
2. 创建常用模式的共享 hooks（如 `useDialogState`）
3. 为关键路径组件添加 React DevTools Profiler 基准测试

---

## 附录：检测工具建议

### ESLint 插件

```json
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

### React DevTools Profiler

使用 React DevTools 的 Profiler 面板可以：
- 识别不必要的重渲染
- 查找渲染耗时较长的组件
- 跟踪 state 变化引起的更新

### 自定义 ESLint 规则

考虑创建自定义规则来检测：
- useEffect 中的 setState 调用（可能是派生状态）
- 缺少 dependencies 数组的 useMemo/useCallback

---

---

## 状态拆分分析

本节分析哪些组件状态可以拆分到子组件中，以避免不必要的整体重渲染。

### 核心原则

1. **状态下沉 (State Colocation)**: 将状态移动到尽可能靠近使用它的组件
2. **独立子组件**: 将频繁更新的状态隔离到独立组件中
3. **选择器优化**: 使用细粒度的 Zustand selectors

---

### 拆分机会 1: FileExplorer 对话框状态

**文件**: [file-explorer.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/file-explorer.tsx)

**当前问题**:
```tsx
// FileExplorer 组件拥有多个对话框状态
const controller = useFileBrowserController(accountId);  // 包含大量状态
const actions = useFileBrowserActions({ ... });           // 包含多个 dialog states
const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
```

每当任一对话框状态变化时，整个 `FileExplorer` 组件都会重渲染，包括 `FileTable`、`TreeView` 等重型子组件。

**优化方案**: 将对话框提取为独立的包装组件

```tsx
// ✅ 方案1: 创建 DialogProvider

// file-explorer-dialogs.tsx
function FileExplorerDialogs({
  controller,
  actions,
}: {
  controller: ReturnType<typeof useFileBrowserController>;
  actions: ReturnType<typeof useFileBrowserActions>;
}) {
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
  
  return (
    <>
      <FilePreviewModal {...} />
      <CreateBucketDialog {...} />
      <AlertDialog open={deleteSelectedDialogOpen} {...} />
      {/* 其他对话框 */}
    </>
  );
}

// file-explorer.tsx
export function FileExplorer({ ... }) {
  return (
    <TooltipProvider>
      <Card>{/* 主要内容 */}</Card>
      <FileExplorerDialogs controller={controller} actions={actions} />
    </TooltipProvider>
  );
}
```

**预期收益**: 对话框状态变化不再触发主内容区域重渲染

**拆分优先级**: 🔴 高

**修复状态**: ✅ 已在 `refactor: extract file explorer dialogs` 和 `refactor: dialog state colocation` 相关提交中完成，`FileExplorerDialogs` 持有全部对话框的 open 状态，`useFileBrowserActions` 仅负责业务操作，父级列表在对话框切换时不再重渲染。

---

### 拆分机会 2: OtherSettingsCard 系统指标

**文件**: [other-settings-card.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/settings/other-settings-card.tsx#L66-78)

**当前问题**:
```tsx
// 每 2 秒更新一次，导致整个设置页面重渲染
const [metrics, setMetrics] = useState<system.SystemMetrics | null>(null);

useEffect(() => {
  const interval = setInterval(fetchMetrics, 2000);
  return () => clearInterval(interval);
}, []);
```

**优化方案**: 将指标显示提取为独立组件

```tsx
// ✅ 提取 MetricsPanel 组件

// metrics-panel.tsx
function MetricsPanel() {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<system.SystemMetrics | null>(null);
  
  useEffect(() => {
    const fetchMetrics = async () => {
      const data = await GetSystemMetrics();
      setMetrics(data);
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);
  
  if (!metrics) return <p>{t("system.metrics.loading")}</p>;
  
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {/* 指标内容 */}
    </div>
  );
}

// other-settings-card.tsx
<SettingsItem label={t("system.metrics.title")}>
  <MetricsPanel />
</SettingsItem>
```

**预期收益**: 每 2 秒的更新只影响指标面板，不影响其他设置项

**拆分优先级**: 🔴 高

**修复状态**: ✅ 已在 `refactor: extract metrics panel component` 中完成，系统指标轮询迁移到独立的 `MetricsPanel`，父级 `OtherSettingsCard` 不再因定时刷新触发整页重渲染。

---

### 拆分机会 3: OtherSettingsCard 更新检查状态

**文件**: [other-settings-card.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/settings/other-settings-card.tsx#L48-50)

**当前问题**:
```tsx
const [updateInfo, setUpdateInfo] = useState<system.UpdateInfo | null>(null);
const [checkingUpdate, setCheckingUpdate] = useState(false);
const [updateError, setUpdateError] = useState<string | null>(null);
```

这三个状态只用于更新检查功能，但放在了主组件中。

**优化方案**: 提取 `UpdateChecker` 组件

```tsx
// ✅ 提取 UpdateChecker 组件

function UpdateChecker() {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<system.UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  const handleCheckUpdates = () => { /* ... */ };
  
  return (
    <div className="flex gap-2">
      <Button onClick={handleCheckUpdates} disabled={checkingUpdate}>
        {checkingUpdate && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
        {t("system.update.button.check")}
      </Button>
      {/* 更新链接按钮 */}
    </div>
  );
}
```

**预期收益**: 更新检查状态变化不影响其他设置项

**拆分优先级**: 🟡 中

**修复状态**: ✅ 已在 `refactor: extract update checker component` 中完成，更新检查逻辑封装成 `UpdateChecker` 子组件，状态变动仅影响该组件。

---

### 拆分机会 4: ObjectDetailsDrawer 多标签内容

**文件**: [object-details-drawer.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/object-details-drawer.tsx)

**当前问题**: 
- 多个 `useState` 用于不同标签页的内容 (metadata, tags, attributes, compliance)
- 三个 `useEffect` 分别加载不同数据
- 切换标签时，所有状态都在同一组件中

**优化方案**: 按标签拆分子组件

```tsx
// ✅ 每个标签页独立加载

// ObjectAttributesTab.tsx
function ObjectAttributesTab({ accountId, bucket, objectKey }: Props) {
  const [attributes, setAttributes] = useState<ObjectAttributes | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // 只在此标签激活时加载
    loadAttributes();
  }, [objectKey]);
  
  return <AttributesDisplay attributes={attributes} />;
}

// ObjectComplianceTab.tsx
function ObjectComplianceTab({ accountId, bucket, objectKey }: Props) {
  const [compliance, setCompliance] = useState<ComplianceInfo | null>(null);
  
  useEffect(() => {
    loadComplianceInfo();
  }, [objectKey]);
  
  return <ComplianceDisplay compliance={compliance} />;
}

// object-details-drawer.tsx
<Tabs>
  <TabsContent value="attributes">
    <ObjectAttributesTab {...} />
  </TabsContent>
  <TabsContent value="compliance">
    <ObjectComplianceTab {...} />
  </TabsContent>
</Tabs>
```

**预期收益**: 
- 延迟加载非活动标签的数据
- 每个标签的状态更新只影响该标签

**拆分优先级**: 🟡 中

---

### 拆分机会 5: SearchPanel 搜索结果

**文件**: [search-panel.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/search/search-panel.tsx)

**当前问题**: 搜索表单和搜索结果在同一组件中，结果更新会导致表单重渲染。

**优化方案**: 将结果显示拆分出去

```tsx
// ✅ 拆分搜索结果

// SearchResults.tsx (从 store 读取结果)
function SearchResults() {
  const results = useSearchStore((s) => s.results);
  const loading = useSearchStore((s) => s.loading);
  
  if (loading) return <Skeleton />;
  return <ResultsList items={results} />;
}

// search-panel.tsx
function SearchPanel() {
  return (
    <div>
      <SearchForm />
      <SearchResults />
    </div>
  );
}
```

**拆分优先级**: 🟢 低

---

### 拆分机会 6: useFileBrowserController 选择状态

**文件**: [useFileBrowserController.ts](file:///Users/macbookpro/Repos/can/frontend/src/hooks/useFileBrowserController.ts)

**当前问题**: 选择状态（`selectedKeys`, `lastSelectedKey`）和导航状态（`level`, `currentBucket`, `prefix`）混在一起。

**优化方案**: 使用更细粒度的 Zustand selectors

```tsx
// ✅ 当前已经较好，但可以进一步优化

// 在 objects.ts store 中，选择状态已经分离
// 使用细粒度 selector 避免不必要订阅
const selectedKeys = useObjectsStore((s) => s.selectedKeys);
const selectedKeysVersion = useObjectsStore((s) => s.selectedKeysVersion);

// 而不是
const { objects, selectedKeys, loading, ... } = useObjectsStore((s) => s);
```

**拆分优先级**: 🟢 低 - 已经做得较好

---

### 拆分机会 7: BrowserToolbar 批量操作菜单

**文件**: [browser-toolbar.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/browser-toolbar.tsx#L271-325)

**当前问题**: 批量操作菜单（Popover）的状态由工具栏管理，每次 `selectedKeys` 变化都会重渲染整个工具栏。

**优化方案**: 提取 `BatchActionsMenu` 组件

```tsx
// ✅ 提取批量操作菜单

function BatchActionsMenu({
  selectedKeys,
  onDownload,
  onMoveCopy,
  onDelete,
}: Props) {
  if (selectedKeys.size === 0) return null;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {t("toolbar.action.selected", { count: selectedKeys.size })}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {/* 菜单内容 */}
      </PopoverContent>
    </Popover>
  );
}
```

**拆分优先级**: 🟢 低

---

### 拆分机会 8: Zustand Store 细粒度化

**涉及文件**: 
- [objects.ts](file:///Users/macbookpro/Repos/can/frontend/src/state/objects.ts)
- [accounts.ts](file:///Users/macbookpro/Repos/can/frontend/src/state/accounts.ts)

**当前情况**: `objectsStore` 包含了约 20 个状态字段和 25 个 actions。

**优化方案**: 使用 slice 模式或细粒度 selectors

```tsx
// ✅ 方案1: 使用细粒度 selectors (推荐，改动小)

// 不好的用法
const state = useObjectsStore((s) => s);

// 好的用法
const loading = useObjectsStore((s) => s.loading);
const objects = useObjectsStore((s) => s.objects);

// ✅ 方案2: 使用 shallow 比较
import { shallow } from 'zustand/shallow';

const { loading, error } = useObjectsStore(
  (s) => ({ loading: s.loading, error: s.error }),
  shallow
);
```

**拆分优先级**: 🟡 中 - 影响范围广，需要逐步重构

---

## Sprint 计划

基于以上分析，制定了 4 个 Sprint 的渐进式优化计划，每个 Sprint 都可以独立完成且不会破坏现有功能。

### Sprint 18: 快速收益优化 (1-2 天)

**目标**: 修复明显的问题，获得即时收益

| 任务 | 文件 | 风险 | 工作量 |
|-----|-----|-----|-------|
| 为 sections 数组添加 useMemo | bucket-settings-page.tsx | 🟢 低 | 0.5h |
| 提取 MetricsPanel 组件 | other-settings-card.tsx | 🟢 低 | 1h |
| 提取 UpdateChecker 组件 | other-settings-card.tsx | 🟢 低 | 1h |
| 优化 TransfersPage 列表排序与 Memo | transfers-page.tsx | 🟢 低 | 0.5h |
| 检查并配置 React Compiler | vite.config.ts | 🟢 低 | 0.5h |
| 删除冗余的 FileTable useEffect | file-table.tsx | 🟢 低 | 0.5h |

**验收标准**:
- [ ] 设置页面每 2 秒的更新不再触发整页重渲染
- [ ] 传输页面列表渲染不再卡顿
- [ ] 代码通过 lint 和 build

---

### Sprint 19: 对话框优化 (2-3 天)

**目标**: 将对话框状态隔离，减少主内容区域重渲染

| 任务 | 文件 | 风险 | 工作量 |
|-----|-----|-----|-------|
| 创建 FileExplorerDialogs 组件 | file-explorer.tsx | 🟡 中 | 3h |
| 将 useFileBrowserActions 中的对话框状态移至新组件 | useFileBrowserActions.ts | 🟡 中 | 2h |
| 为 Monaco/Markdown 添加 Lazy Loading | file-preview-modal.tsx | 🟢 低 | 1h |
| 为所有对话框添加 key prop 方案 | 多个文件 | 🟢 低 | 2h |

**验收标准**:
- [ ] 打开/关闭对话框时，文件列表不重渲染
- [ ] 预览大文件时首屏加载不受影响
- [ ] 现有功能全部正常

---

### Sprint 20: Store 优化 (2-3 天)

**目标**: 优化 Zustand store 的使用模式

| 任务 | 文件 | 风险 | 工作量 |
|-----|-----|-----|-------|
| 审查并优化所有 useObjectsStore 调用 | 全项目 | 🟡 中 | 4h |
| 为复合 selector 添加 shallow 比较 | 多个文件 | 🟢 低 | 2h |
| 添加 ESLint 规则检测粗粒度 selector | eslint config | 🟢 低 | 1h |

**验收标准**:
- [ ] 使用 React DevTools Profiler 验证渲染次数减少
- [ ] 所有 store 订阅使用细粒度 selector

---

### Sprint 21: 深度优化 (3-4 天)

**目标**: 完成剩余的组件拆分和虚拟化

| 任务 | 文件 | 风险 | 工作量 |
|-----|-----|-----|-------|
| ObjectDetailsDrawer 标签页拆分 | object-details-drawer.tsx | 🟡 中 | 4h |
| SearchPanel 拆分 | search-panel.tsx | 🟢 低 | 2h |
| BatchActionsMenu 提取 | browser-toolbar.tsx | 🟢 低 | 1h |
| 为 TransfersPage 添加列表虚拟化 | transfers-page.tsx | 🟡 中 | 3h |
| 性能测试和文档更新 | 测试 + 文档 | 🟢 低 | 2h |

**验收标准**:
- [ ] 传输列表支持 1000+ 条目流畅滚动
- [ ] 创建性能基准测试
- [ ] 更新开发文档

---

## 性能与构建优化 (Performance & Build)

本节涵盖了对构建体积和运行时性能有显著影响的优化点，已整合到上述 Sprint 计划中。

### 1. 重型组件的懒加载 (Lazy Loading)

**文件**: `file-preview-modal.tsx`

**问题**:
Monaco Editor (`@monaco-editor/react`) 和 Markdown 渲染器 (`react-markdown`) 都是体积巨大的库。目前它们是**静态导入**的，这意味着即使用户只浏览图片，这些 JS 代码也会被加载。

**方案**:

```tsx
// ✅ 动态导入
const MonacoEditor = React.lazy(() => import("@monaco-editor/react"));
const ReactMarkdown = React.lazy(() => import("react-markdown"));

// ✅ 使用 Suspense
<Suspense fallback={<Loader2 className="animate-spin" />}>
  {mode === "edit" ? <MonacoEditor ... /> : <ReactMarkdown ... />}
</Suspense>
```

**修复状态**: ✅ 已在 `perf: lazy load preview editors` 中完成，`file-preview-modal.tsx` 改用 `React.lazy` + `Suspense` 动态加载 Monaco Editor 与 ReactMarkdown，非预览场景不再提前下载大型依赖。

### 2. 传输列表的虚拟化与 Memo

**文件**: `transfers-page.tsx`

**问题**:
1. **排序计算**: 每次渲染都在进行排序操作。
2. **长列表**: 普通 `Table` 渲染渲染大量历史记录时会卡顿。

**方案**:
1. **Memoization**: 使用 `useMemo` 缓存排序结果。(Sprint 18)
2. **Virtualization**: 使用 `TanStack Virtual` 虚拟化列表。(Sprint 21)

```tsx
const taskList = useMemo(() => 
  Object.values(tasks).sort((a, b) => getTaskProgressRatio(b) - getTaskProgressRatio(a)),
  [tasks]
);
```

**修复状态**: ✅ 已在 `perf: memoize transfers task list` 中完成，任务列表排序改为 `useMemo` 缓存并拆分 `TaskRow` memo 组件，仅在 `tasks` 变化时才重渲染。

### 3. React 19 编译器

**项目级优化**:
检查 `vite.config.ts` 是否正确配置 `babel-plugin-react-compiler`，以利用 React 19 的自动 memoization 特性，减少手动优化负担。

**修复状态**: ✅ 已在 `build: enable react compiler plugin` 中完成，`vite.config.ts` 为 `@vitejs/plugin-react` 注入 `babel-plugin-react-compiler`，构建阶段自动应用 React Compiler。

---

---

## 附录：快速检查清单

在 Code Review 时可以使用此清单：

### useEffect 检查

- [ ] 该 effect 是否在做数据获取或订阅？→ ✅ 合理
- [ ] 该 effect 是否只是将 props 复制到 state？→ ❌ 考虑使用派生值
- [ ] 该 effect 的依赖项是否最小化？
- [ ] 是否有清理函数（如果需要）？

### 状态检查

- [ ] 这个 state 能否通过 props 或其他 state 计算得出？→ 使用 useMemo
- [ ] 这个 state 只被一个子组件使用？→ 移动到子组件
- [ ] 多个 state 总是一起更新？→ 考虑合并为对象

### 组件检查

- [ ] 组件是否渲染大型列表？→ 检查是否需要 memo
- [ ] 组件是否有多个独立的状态块？→ 考虑拆分
- [ ] 父组件更新时这个组件需要更新吗？→ 考虑 memo

---

---

## Zod + TanStack Form 优化

将组件内的验证逻辑迁移到 Zod schema，配合 TanStack Form 统一管理表单状态。

### 技术规范

- **表单库**: `@tanstack/react-form`
- **验证库**: `zod` + `@tanstack/zod-form-adapter`
- **原则**: 验证逻辑在 schema 定义时完成，组件只负责渲染

---

### 1. 创建共享验证库

**新建文件**: `lib/validators.ts`

```tsx
import { z } from "zod";
import type { TFunction } from "i18next";

// ========== 基础验证器 ==========

export const requiredString = (message: string) =>
  z.string().trim().min(1, message);

export const optionalString = () =>
  z.string().trim().optional().or(z.literal(""));

// ========== 文件名验证器 ==========

export const fileName = (t: TFunction) =>
  z
    .string()
    .trim()
    .min(1, t("validation.fileName.required"))
    .refine((val) => !val.includes("/"), t("validation.fileName.noSlash"))
    .refine((val) => val !== "." && val !== "..", t("validation.fileName.reserved"));

// ========== 端口验证器 ==========

export const port = (t: TFunction) =>
  z
    .number({ message: t("validation.port.number") })
    .int(t("validation.port.integer"))
    .min(1, t("validation.port.range"))
    .max(65535, t("validation.port.range"));

// ========== 速度限制验证器 ==========

export const speedLimitMB = (t: TFunction) =>
  z
    .string()
    .transform((val) => (val === "" ? 0 : parseFloat(val)))
    .pipe(z.number().min(0, t("validation.speedLimit.min")).max(10000));

// ========== 范围验证器 ==========

export const sizeRange = (t: TFunction) =>
  z
    .object({ minSize: z.number().min(0), maxSize: z.number().min(0) })
    .refine((d) => d.maxSize === 0 || d.maxSize >= d.minSize, {
      message: t("validation.sizeRange.invalid"),
      path: ["maxSize"],
    });

export const dateRange = (t: TFunction) =>
  z
    .object({ startTime: z.string().optional(), endTime: z.string().optional() })
    .refine((d) => !d.startTime || !d.endTime || new Date(d.startTime) <= new Date(d.endTime), {
      message: t("validation.dateRange.invalid"),
      path: ["endTime"],
    });
```

---

### 2. RenameDialog 迁移

**文件**: [rename-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/rename-dialog.tsx)

```tsx
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { fileName } from "@/lib/validators";

// Schema 定义
const renameSchema = (t: TFunction, currentBasename: string) =>
  z.object({
    newName: fileName(t).refine((val) => val !== currentBasename, t("objects.rename.error.same")),
  });

// 组件实现
export function RenameDialog({ open, onOpenChange, objectKey, prefix }: Props) {
  const { t } = useTranslation();
  const currentBasename = getBasename(objectKey || "");

  const form = useForm({
    defaultValues: { newName: currentBasename },
    validatorAdapter: zodValidator(),
    validators: { onChange: renameSchema(t, currentBasename) },
    onSubmit: async ({ value }) => {
      await objectsStore.renameObject(objectKey!, (prefix || "") + value.newName);
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
          <form.Field name="newName">
            {(field) => (
              <>
                <Input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                />
                {field.state.meta.errors.length > 0 && (
                  <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
                )}
              </>
            )}
          </form.Field>
          <Button type="submit" disabled={!form.state.canSubmit}>
            {t("rename")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 3. CreateFolderDialog 迁移

**文件**: [create-folder-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/objects/create-folder-dialog.tsx)

```tsx
// Schema 定义
const createFolderSchema = (t: TFunction, existingFolders: string[], prefix: string) =>
  z.object({
    folderName: fileName(t).refine(
      (val) => {
        const normalized = val.replace(/\/$/, "");
        return !existingFolders.some((f) => {
          if (!f.startsWith(prefix)) return false;
          return f.slice(prefix.length).replace(/\/$/, "") === normalized;
        });
      },
      t("objects.createFolder.error.exists")
    ),
  });

// 组件实现
export function CreateFolderDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const objects = useObjectsStore((s) => s.objects);
  const prefix = useObjectsStore((s) => s.prefix);
  const existingFolders = objects.filter((o) => o.isDir).map((o) => o.key);

  const form = useForm({
    defaultValues: { folderName: "" },
    validatorAdapter: zodValidator(),
    validators: { onChange: createFolderSchema(t, existingFolders, prefix) },
    onSubmit: async ({ value }) => {
      await objectsStore.createFolder(value.folderName);
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
        <form.Field name="folderName">
          {(field) => (
            <>
              <Input
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {field.state.meta.errors[0] && (
                <p className="text-sm text-destructive">{field.state.meta.errors[0]}</p>
              )}
            </>
          )}
        </form.Field>
        <Button type="submit" disabled={!form.state.canSubmit}>
          {t("create")}
        </Button>
      </form>
    </Dialog>
  );
}
```

---

### 4. SymlinkDialog 迁移

**文件**: [symlink-dialog.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/browser/symlink-dialog.tsx)

```tsx
// Schema 定义
const symlinkSchema = (t: TFunction) =>
  z.object({
    symlinkName: fileName(t),
    symlinkTargetKey: requiredString(t("symlink.error.targetRequired")),
  });

// 组件实现
export function SymlinkDialog({ open, onOpenChange, accountId, bucket, prefix }: Props) {
  const { t } = useTranslation();

  const form = useForm({
    defaultValues: { symlinkName: "", symlinkTargetKey: "" },
    validatorAdapter: zodValidator(),
    validators: { onChange: symlinkSchema(t) },
    onSubmit: async ({ value }) => {
      const linkKey = `${prefix}${value.symlinkName}`.replace(/\/{2,}/g, "/");
      await CreateSymlink(accountId!, bucket!, linkKey, value.symlinkTargetKey);
      await objectsStore.refresh();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
        <form.Field name="symlinkName">
          {(field) => <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
        </form.Field>
        <form.Field name="symlinkTargetKey">
          {(field) => <Input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />}
        </form.Field>
        <Button type="submit" disabled={!form.state.canSubmit || !bucket}>
          {t("create")}
        </Button>
      </form>
    </Dialog>
  );
}
```

---

### 5. AccountFormDrawer 迁移

**文件**: [account-form-drawer.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/accounts/account-form-drawer.tsx)

```tsx
// 创建模式 Schema（密钥必填）
const createAccountSchema = (t: TFunction) =>
  z.object({
    name: requiredString(t("account.form.field.name.error.required")),
    provider: requiredString(t("account.form.field.provider.error.required")),
    endpoint: requiredString(t("account.form.field.endpoint.error.required")),
    accessKeyId: requiredString(t("account.form.field.accessKeyId.error.required")),
    secretAccessKey: requiredString(t("account.form.field.secretAccessKey.error.required")),
    region: optionalString(),
    useSSL: z.boolean(),
    port: port(t),
    tag: optionalString(),
  });

// 编辑模式 Schema（密钥可选）
const editAccountSchema = (t: TFunction) =>
  z.object({
    name: requiredString(t("account.form.field.name.error.required")),
    provider: requiredString(t("account.form.field.provider.error.required")),
    endpoint: requiredString(t("account.form.field.endpoint.error.required")),
    accessKeyId: optionalString(),
    secretAccessKey: optionalString(),
    region: optionalString(),
    useSSL: z.boolean(),
    port: port(t),
    tag: optionalString(),
  });

// 组件实现
export function AccountFormDrawer({ open, onOpenChange, mode, initialAccount }: Props) {
  const { t } = useTranslation();
  const schema = mode === "create" ? createAccountSchema(t) : editAccountSchema(t);

  const form = useForm({
    defaultValues: initialAccount ?? defaultFormValues,
    validatorAdapter: zodValidator(),
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      if (mode === "create") {
        await accountsStore.createAccount(value);
      } else {
        await accountsStore.updateAccount(initialAccount!.id, value);
      }
      onOpenChange(false);
    },
  });

  // 渲染表单字段...
}
```

---

### 6. TransferCacheCard 速度限制迁移

**文件**: [transfer-cache-card.tsx](file:///Users/macbookpro/Repos/can/frontend/src/components/settings/transfer-cache-card.tsx)

```tsx
import { speedLimitMB } from "@/lib/validators";

// Schema 定义
const speedLimitSchema = (t: TFunction) =>
  z.object({ speedLimit: speedLimitMB(t) });

// 提取为独立组件
function SpeedLimitInput() {
  const { t } = useTranslation();
  const globalSpeedLimit = useTransfersStore((s) => s.globalSpeedLimit);

  const form = useForm({
    defaultValues: { speedLimit: bytesToMB(globalSpeedLimit).toString() },
    validatorAdapter: zodValidator(),
    validators: { onBlur: speedLimitSchema(t) },
    onSubmit: async ({ value }) => {
      await transfersStore.setGlobalSpeedLimit(mbToBytes(value.speedLimit));
    },
  });

  return (
    <form.Field name="speedLimit">
      {(field) => (
        <Input
          value={field.state.value}
          onChange={(e) => field.handleChange(e.target.value)}
          onBlur={() => { field.handleBlur(); form.handleSubmit(); }}
        />
      )}
    </form.Field>
  );
}
```

---

### 7. 设置页面 Schema 定义

**文件**: `state/preferences.ts` (类型单一事实来源)

```tsx
import { z } from "zod";

// ========== Schema 定义 ==========

export const advancedOptionsSchema = z.object({
  databaseDriver: z.enum(["sqlite", "memory"]),
  logLevel: z.enum(["debug", "info", "warn", "error"]),
});

export const sessionSettingsSchema = z.object({
  idleTimeoutMinutes: z.enum(["0", "15", "60"]).transform(Number),
  lockStrategy: z.enum(["lock", "logout"]),
});

// ========== 类型推断 ==========

export type AdvancedOptions = z.infer<typeof advancedOptionsSchema>;
export type SessionSettings = z.infer<typeof sessionSettingsSchema>;

// ========== localStorage 加载时验证 ==========

export const loadAdvancedOptions = (): AdvancedOptions => {
  const stored = localStorage.getItem(ADVANCED_SETTINGS_KEY);
  if (!stored) return DEFAULT_ADVANCED_OPTIONS;
  const result = advancedOptionsSchema.safeParse(JSON.parse(stored));
  return result.success ? result.data : DEFAULT_ADVANCED_OPTIONS;
};
```

---

## Zod 优化 Sprint 计划

### Sprint 22: 基础设施 (1 天)

| 任务 | 工作量 |
|-----|-------|
| 创建 `lib/validators.ts` | 1h |
| 添加 TanStack Form 依赖和 zod-form-adapter | 0.5h |
| 创建 `components/ui/form-field.tsx` 封装 | 1h |
| 更新 `state/preferences.ts` 使用 Zod schema | 1h |

### Sprint 23: 对话框迁移 (2 天)

| 任务 | 工作量 |
|-----|-------|
| RenameDialog 迁移 | 1h |
| CreateFolderDialog 迁移 | 1.5h |
| SymlinkDialog 迁移 | 1h |
| CreateBucketDialog 迁移 | 1.5h |
| 单元测试更新 | 1h |

### Sprint 24: 表单和设置迁移 (2 天)

| 任务 | 工作量 |
|-----|-------|
| AccountFormDrawer 迁移 | 2h |
| SearchPanel schema 优化 | 1h |
| SpeedLimitInput 提取和迁移 | 1.5h |
| 删除旧的 validate 函数和冗余状态 | 1h |

---

---
