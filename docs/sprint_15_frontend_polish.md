# Sprint 15: 前端体验优化与 BUG 修复 (Frontend Polish & Bug Fixes)

> **Status: ✅ COMPLETED** (2025-12-10)
>
> 所有核心任务已实现并验证通过。

本次 Sprint 面向终端体验与交互稳定性，聚焦列表多选、导航视图、分页性能与遗留页面清理。除用户列出的 2.1–2.5 项以外，还结合代码库提供额外建议，以确保前端与 Sprint 14 新后端契约对齐。

---

## 1. 列表视图多选失效 (需求 2.1)

### 现状与根因
- 列表模式由 `frontend/src/components/browser/file-table.tsx` 控制，Shift 选择调用 `onSelectAll(keysToSelect)`；该回调最终执行 `objectsStore.selectAll`（定义于 `frontend/src/state/objects.ts`）。
- `selectAll` 每次都会用参数 keys 创建全新 `Set` 并覆盖原集合（第 516 行左右），导致非顺序选择、跳行或自底向上选择时，之前勾选的项目被覆盖。
- `file-table.tsx` 还在普通点击时调用 `onClearSelection()` 后再 `onToggleSelect(key)`，若切换滚动位置重新渲染，会丢失 `lastSelectedKey` 状态。

### 方案
1. **Store 扩展**：在 `objectsStore` 中新增 `selectRange(keys: string[], opts?: { merge?: boolean })`，默认 merge 现有选择。`selectAll()` 保留“全选”语义，而 range 选择调用新的 action，避免覆盖。
2. **Table 行为修复**：
   - `file-table.tsx` 的 Shift 分支改为调用 `selectRange(rangeKeys, { merge: true })`；
   - 普通点击不再总是 `clear → toggle`，而是检测 `selectedKeys.size` 与 `isSelected` 后决定是否切换单选或清空；
   - `lastSelectedKey` 存储在 Zustand（例如 `objectsStore.lastSelectedKey`）或组件 `useRef`，避免虚拟滚动重新渲染时丢失信息。
3. **Selection 与视图同步**：`frontend/src/components/browser/file-explorer.tsx` 在切换视图模式时保留 `selectedKeys`，但 `grid`/`tree` 组件对 `selectedKeys` 的引用需要 `useMemo` 保持引用稳定，避免虚拟滚动触发二次选择。

### 验收
- 跳行、多段、逆序选择均不会清空已有勾选；`selectedKeys.size` 始终等于视觉上勾选的项。
- 新增 Vitest 覆盖：`objectsStore.selectRange` 对合并/替换行为的单元测试；`file-table` 交互可用 React Testing Library 模拟。
- 手动验证：在网格/列表/树视图之间切换，勾选状态保持一致。

---

## 2. 移除安全中心页面 (需求 2.2)

### 现状
- 路由：`frontend/src/routes/accounts/$accountId/security.tsx`；页面组件 `frontend/src/pages/security-page.tsx`。
- 侧边栏入口：`frontend/src/components/layouts/sidebar.tsx`（Security 菜单项）。
- 相关状态：`frontend/src/state/security.ts` 及 `frontend/src/components/security/*`。

### 方案
1. 删除路由文件与页面组件，移除 `security` namespace 下的 UI 与 store，清理 `wailsjs` 生成的绑定。
2. 更新侧边栏与任何引用 `SecurityDashboard` 的位置（如帮助页面链接 `frontend/src/pages/help-page.tsx:389`）。
3. 若后续需要安全审计，仅保留文档层面的指引，可在 README 的“更多文档”列表中新增链接。

### 验收
- `pnpm --dir frontend build` 无 `security` 相关 import，Tree Shaking 后 bundle 体积下降。
- 侧边栏不再展示安全中心入口；访问旧路由直接 404 或重定向到账户概览。

---

## 3. 视图切换 ICON 顺序与默认模式 (需求 2.3)

### 现状
- `useFileBrowserController` 默认 `viewMode = "grid"` (`frontend/src/hooks/useFileBrowserController.ts:112`)，但 `BrowserToolbar` (`frontend/src/components/browser/browser-toolbar.tsx:200-230`) 按钮顺序为 List → Tree → Grid，导致视觉默认与按钮位置不一致。
- 视图首选项未持久化，每次刷新都回到 grid；ICON Tooltip 也未突出默认模式。

### 方案
1. **调整按钮顺序**：改为 Grid → List → Tree，保持默认模式在首位；同时更新 `title`/Tooltip 说明。
2. **首选项持久化**：将 `viewMode` 存入 `preferencesStore`（`frontend/src/state/preferences.ts`），`useFileBrowserController` 初始化时读取；切换时写回 store。
3. **可访问性**：为 active 按钮添加 `aria-pressed`，并在 grid 模式下将 ICON 描述设为 “Default view (Grid)”。

### 验收
- 进入文件浏览器时，按钮首位为 Grid 且处于激活状态。
- 切换模式、刷新应用后仍保持用户选择。

---

## 4. 列表视图分页 (需求 2.4)

### 现状
- `objectsStore.refresh` / `loadMore` 调用 `ListObjects(accountId, { limit: 500 })`（`frontend/src/state/objects.ts:485`），一次加载 500 条，UI 仅通过 “加载更多” button 分段渲染，未提供页大小控制。
- 后端 `internal/objects/service.go`、`internal/providers/storage.go` 已支持 `Limit + Marker + Prefix + Delimiter` 组合查询；`providers/s3_storage_client.go:394-417` 使用 AWS SDK `ListObjectsV2`，天然支持筛选+分页。

### 方案
1. **前端分页模型**：
   - 为 `objectsStore` 增加 `pageSize` 状态（默认 30，可通过设置页或 Toolbar 下拉修改）。
   - `ListObjects` 调用使用 `pageSize` 作为 `limit`；`loadMore` 仅在 `truncated === true` 时发起下一页。
   - 列表模式新增 `TableFooterPaginator` 组件，集中展示“每页条数 + 上一页/下一页”控件并复用 `objectsStore.loadMore`，Toolbar 不再重复这组控件。
2. **API 契约**：
   - 后端无需变更，但要确认所有 Provider 驱动均实现 `Marker`/`ContinuationToken`（OSS/COS 驱动在 `oss_storage_client.go:295+`、`cos_storage_client.go:428+` 已支持）。若某些驱动不支持，则在 Capability Matrix 中标记 `object.pagination` 并在 UI 显示提示。
3. **S3 筛选能力确认**：
   - README 架构中 Unified Interface 的 S3 SDK 层已支持 Prefix/Delimiter 过滤，可在文档附录中记录验证命令（使用 awscli `aws s3api list-objects-v2 --prefix ... --max-items 30`）。

### 验收
- 默认仅渲染 30 条；点击下一页可持续加载直至 `truncated=false`。
- 切换前缀或视图模式时，表格脚部自动跳回第 1 页。
- 若 Provider 不支持分页组合，会在 UI 显示不可用提示并自动回退到无限滚动。

---

## 5. 高频渲染性能优化 (需求 2.5)

### 5.1 Table
- 虽已应用 `@tanstack/react-virtual`，但 `selectedKeys` 每次更新都会创建新 `Set`，传入 `FileTable` 后触发虚拟列表全量重渲染。
- 方案：
  - 在 store 中存储 `selectedKeysVersion` 或返回 `selectedKeysArray`，让组件通过 `useMemo` + `useStoreWithSelector(shallow)` 读取，减小引用变化。
  - 对 `TableRowContextMenu` 和单元格操作按钮使用 `useCallback`，避免闭包造成 diff。

### 5.2 Tree
- `frontend/src/components/browser/tree-view.tsx` 每次渲染都会从 `objects` 重新构建树形节点，且递归组件未 memo，导致每次勾选都遍历整棵树。
- 方案：
  1. 将树数据构建逻辑挪至 `useFileBrowserController`，并用 `useMemo` 缓存 `prefix + objects` 组合结果。
  2. `TreeNode` 组件用 `React.memo` 包裹，并通过 `selectedKeys.has` 与 `node.id` 比较避免深层 diff。
  3. 对超过 N 条数据时启用按层级虚拟化（可复用 `react-virtualized` 的 `FixedSizeTree`），减少 DOM 负荷。

### 5.3 其他热点
- `frontend/src/components/browser/browser-toolbar.tsx` 的筛选输入在每次 keypress 时触发状态更新，可加入 `useDeferredValue`。
- `transfersStore` 状态被多个组件直接全量订阅，可提炼 selector，避免后台任务刷新导致 File Explorer 重渲染。

### 5.4 Tree 视图展开分页（Lazy Load）
- **问题**：`tree-view.tsx` 展开子文件夹时调用 `loadPrefix()` 一次性加载该前缀下所有 objects（使用 `listChildren`），若子文件夹含 1000+ 文件，会导致：
  - 网络请求延迟高
  - DOM 节点过多，滚动卡顿
  - 内存占用增加
- **方案**：
  1. 在 `loadPrefix()` 中使用 `objectsStore.pageSize` 作为 `limit`；
  2. 若返回 `truncated=true`，在节点末尾显示「加载更多…」子节点；
  3. 点击「加载更多」时追加下一页数据到 `children`；
  4. 可选：对超大数据量启用按层级虚拟化（`react-window` 或 `react-virtualized`）。
- **验收**：展开含 1000 文件的文件夹时，首次仅加载 30 条，点击按钮继续加载。

### 验收
- 列表 1k 条数据下切换勾选/分页时，React DevTools 观察每帧渲染组件数显著下降。
- Chrome Performance/Profiler 中，Table 与 Tree 的 commit 时间小于 16ms。

---

## 6. 额外建议

1. **生命周期提示与空状态**：在移除安全中心后，可在帮助页或空桶状态加入“安全提示”链接，指向 README 或 docs/sprint_4_security.md，保持安全教育内容。
2. **统一批量操作入口**：当前 `BrowserToolbar` 和 `contexts` 中都有删除/下载入口，建议使用 `objectsStore.selectedKeys` 判断后，仅保留 Toolbar 的“批量操作”按钮，避免交互冲突。
3. **前端与后端分页协同**：待 Sprint 14 后端完成后，在 `@wailsjs/go/models` 中生成新的 `ListObjectsInput`/`Result` TS 类型，前端直接引用，减少魔法字符串。

---

## 7. 账户切换体验与连接监控（新增）

### 现状
- 账户列表页 (`account-selector.tsx`) 会为所有账户并发触发 `testConnection`，拉高冷启动时延与 API 调用量。
- 侧边栏切换器 (`account-switcher.tsx`) 只有最简链接，无法提示连接状态或当前测试结果。

### 方案
1. **探针迁移至侧边栏**：仅对当前激活账户以 30s 轮询频率执行 `accountsStore.testConnection`，并在 `AccountSwitcher` 中显示点状状态与 Tooltip。
2. **切换流程解耦**：先 `setActiveAccount` 并导航，再异步触发 `testConnection`，失败通过 toast/banner 提示，而不是阻塞按钮。
3. **列表页共享状态**：`AccountCard`/`AccountSelector` 直接读取 `connectionTests`，在进入仪表盘前即可看到最新健康状态，Sidebar 继续负责轮询刷新。

### 验收
- 进入仪表盘 30 秒内 Sidebar 指示灯即可反映连通性，失败时 Tooltip 展示后端返回的 message。
- 切换账户时先完成 `setActiveAccount` 并立即跳转，按钮仅在极短的切换窗口内禁用；探针失败会通过 toast 通知而不会阻塞其它操作。
- 列表页与 Sidebar 使用同一份 `connectionTests` 数据，`AccountCard` 等组件能同步展示健康状态。

---

## 验收与测试清单

- `pnpm --dir frontend test`：新增 selection/pagination 单元测试应全部通过。
- `pnpm --dir frontend dev` 手动验证五项需求场景；使用 `localstack` 或 MinIO 搭建环境，确保分页 + 多选 + 删除等操作无错误。
- `go test ./internal/objects`（依赖 Sprint 14 的分页保障）以验证 limit/marker 语义。

---

## 参考文件

- `frontend/src/components/browser/file-table.tsx`
- `frontend/src/state/objects.ts`
- `frontend/src/components/browser/browser-toolbar.tsx`
- `frontend/src/components/browser/tree-view.tsx`
- `frontend/src/hooks/useFileBrowserController.ts`
- `frontend/src/state/preferences.ts`

---

## 实现总结 (Implementation Summary)

### ✅ 需求 2.1 - 列表视图多选

- **`objectsStore`** 新增 `selectRange(keys, { merge })` 方法，支持合并选择
- **`lastSelectedKey`** 存储在 Zustand store，避免虚拟滚动丢失状态
- **`file-table.tsx`** 和 **`tree-view.tsx`** 均实现 OS 标准多选行为：
  - Shift+Click: 范围选择 + 合并
  - Ctrl/Cmd+Click: 切换单项
  - 普通点击: 单选或清空

### ✅ 需求 2.2 - 移除安全中心页面

- 路由 `/accounts/$accountId/security.tsx` 已删除
- `sidebar.tsx` 无安全中心入口
- `help-page.tsx` 仅保留外部安全文档链接

### ✅ 需求 2.3 - 视图切换 ICON 顺序与默认模式

- **`browser-toolbar.tsx`** 按钮顺序调整为 Grid → List → Tree
- 添加 `aria-pressed` 可访问性属性
- **`preferencesStore`** 持久化 `viewMode`，刷新后保持用户选择

### ✅ 需求 2.4 - 列表视图分页

- **`objectsStore`** 新增 `pageSize` 状态（默认 30）
- **`listChildrenPaginated`** 方法支持 limit/marker 分页
- **`TableFooterPaginator`** 统一承载列表视图分页控件

### ✅ 需求 2.5 - 高频渲染性能优化

- **`TreeNode`** 使用 `React.memo` + 自定义比较函数
- `tree-view.tsx` 使用 `listChildrenPaginated` 懒加载子节点
- 展开文件夹时显示「加载更多...」按钮

### ✅ 新增 - 账户切换 & 连接监控

- Sidebar `AccountSwitcher` 增加健康指示灯、定时探针与“切换前测试”流程
- `AccountCard`/`AccountSelector` 与 Sidebar 共享 `connectionTests`，在列表页即可看到实时健康状态

---

## 追加优化 (2025-12-10)

### ✅ List 视图表格底部分页器

- 新增 **`TableFooterPaginator`** 组件，显示在表格底部左侧
- 支持“每页数量 + 上一页/下一页”与游标驱动的 `loadMore` 联动
- Grid 模式仍沿用顶部「加载更多」按钮，避免重复控件

### ✅ Tree 视图内存优化

- 新增 **`TREE_PAGE_SIZE = 100`** 常量
- 展开文件夹时最多加载 100 条，超出显示「加载更多...」
- 适用于 `loadRoot`、`toggleNode`、`loadMoreChildren`
- 防止大文件夹展开时 OOM
