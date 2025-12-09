# Sprint 15: 前端体验优化与 BUG 修复 (Frontend Polish & Bug Fixes)

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
   - Toolbar 新增分页指示器（例如 “显示 1–30 / 180”），并提供“上一页/下一页”按钮，保持与 `nextMarker` 一致。
2. **API 契约**：
   - 后端无需变更，但要确认所有 Provider 驱动均实现 `Marker`/`ContinuationToken`（OSS/COS 驱动在 `oss_storage_client.go:295+`、`cos_storage_client.go:428+` 已支持）。若某些驱动不支持，则在 Capability Matrix 中标记 `object.pagination` 并在 UI 显示提示。
3. **S3 筛选能力确认**：
   - README 架构中 Unified Interface 的 S3 SDK 层已支持 Prefix/Delimiter 过滤，可在文档附录中记录验证命令（使用 awscli `aws s3api list-objects-v2 --prefix ... --max-items 30`）。

### 验收
- 默认仅渲染 30 条；点击下一页可持续加载直至 `truncated=false`。
- 切换前缀或视图模式时，分页指示器归零。
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

### 验收
- 列表 1k 条数据下切换勾选/分页时，React DevTools 观察每帧渲染组件数显著下降。
- Chrome Performance/Profiler 中，Table 与 Tree 的 commit 时间小于 16ms。

---

## 6. 额外建议

1. **生命周期提示与空状态**：在移除安全中心后，可在帮助页或空桶状态加入“安全提示”链接，指向 README 或 docs/sprint_4_security.md，保持安全教育内容。
2. **统一批量操作入口**：当前 `BrowserToolbar` 和 `contexts` 中都有删除/下载入口，建议使用 `objectsStore.selectedKeys` 判断后，仅保留 Toolbar 的“批量操作”按钮，避免交互冲突。
3. **前端与后端分页协同**：待 Sprint 14 后端完成后，在 `@wailsjs/go/models` 中生成新的 `ListObjectsInput`/`Result` TS 类型，前端直接引用，减少魔法字符串。

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
- `frontend/src/routes/accounts/$accountId/security.tsx`
- `internal/providers/s3_storage_client.go`, `internal/providers/oss_storage_client.go`, `internal/providers/cos_storage_client.go`

