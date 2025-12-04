# 前端重新设计 - 实现清单

## 项目概览
本文档提供按优先级排序的实现任务清单，员工应按照优先级逐项完成，并在完成后更新对应的复选框。

---

## Phase 1: 基础架构与路由（优先级：⭐⭐⭐⭐⭐）

### 1.1 依赖安装与配置
- [ ] 安装 TanStack Router: `pnpm add @tanstack/react-router @tanstack/react-router-devtools --dir frontend`
- [ ] 验证版本：`pnpm list @tanstack/react-router --dir frontend`
- [ ] 创建 `frontend/src/routes/` 目录结构
- [ ] 创建根路由文件 `frontend/src/routes/root.tsx`
- [ ] 创建路由入口配置 `frontend/src/routes/__root.tsx`（TanStack 标准命名）

### 1.2 布局组件框架
- [ ] 创建 `frontend/src/components/layouts/HomeLayout.tsx`
  - [ ] 包含导航栏（仅显示 Logo 和设置入口）
  - [ ] 主内容区域 placeholder
  - [ ] 导出/导入按钮放在此处

- [ ] 创建 `frontend/src/components/layouts/DashboardLayout.tsx`
  - [ ] 左侧 Sidebar 区域（220px）
  - [ ] 右侧主内容区域（flex-1）
  - [ ] 传递 `children` 给主内容区

- [ ] 创建 `frontend/src/components/layouts/Sidebar.tsx`
  - [ ] 账户切换器区域
  - [ ] 系统设置链接
  - [ ] 帮助与反馈链接
  - [ ] 主题切换按钮

### 1.3 页面容器组件
- [ ] 创建 `frontend/src/pages/HomePage.tsx`
  - [ ] 导入 HomeLayout
  - [ ] 包含首页内容组件（待创建）

- [ ] 创建 `frontend/src/pages/DashboardPage.tsx`
  - [ ] 导入 DashboardLayout
  - [ ] 包含 BucketBrowser 和 ObjectBrowser

- [ ] 创建 `frontend/src/pages/SettingsPage.tsx`
  - [ ] 骨架页面（功能在 Phase 3 实现）

### 1.4 主应用入口改造
- [ ] 备份现有 `frontend/src/App.tsx`
- [ ] 更新 `frontend/src/main.tsx`，集成 TanStack Router：
  ```typescript
  import { RouterProvider, createRouter } from '@tanstack/react-router'
  import { routeTree } from './routeTree.gen'
  
  const router = createRouter({ routeTree })
  
  declare module '@tanstack/react-router' {
    interface Register {
      router: typeof router
    }
  }
  
  export default function App() {
    return <RouterProvider router={router} />
  }
  ```
- [ ] 运行 TanStack Router 代码生成：`pnpm --dir frontend run tsr`
- [ ] 测试：运行 `pnpm --dir frontend dev`，确认路由加载正常

### 1.5 Zustand Store 优化
- [ ] 编辑 `frontend/src/state/accounts.ts`
  - [ ] 添加 `activeAccountId: string | null` 到 state
  - [ ] 修改 `bootstrap()` 方法（参考 FRONTEND_REDESIGN_PLAN.md 第 9.1 节）
    - [ ] 调用 `window.go.main.App.ListAccounts()`
    - [ ] 调用 `window.go.main.App.ActiveAccount()`
    - [ ] 设置 activeAccountId（优先使用 ActiveAccount 返回值，否则使用第一个）
  - [ ] 验证 `setActiveAccount()` 正确更新 activeAccountId
  - [ ] 添加 `connectionTests` 对象以缓存各账户的连接状态

- [ ] 单元测试
  - [ ] 测试 `bootstrap()` 正确加载账户列表
  - [ ] 测试 `setActiveAccount()` 更新活跃账户
  - [ ] 测试错误处理（网络错误时的降级）

---

## Phase 2: 首页账户选择（优先级：⭐⭐⭐⭐⭐）

### 2.1 账户卡片组件
- [ ] 创建 `frontend/src/components/accounts/AccountCard.tsx`
  - [ ] Props: `account: AccountModel`
  - [ ] 显示账户名称、Provider 类型、Endpoint
  - [ ] 显示连接状态指示符（圆点：绿/红/灰）
  - [ ] 点击导航到 `/accounts/[id]/dashboard`
  - [ ] 设计参考：FRONTEND_REDESIGN_PLAN.md 第 9.3 节代码示例

- [ ] 创建 `frontend/src/components/accounts/AccountCardGrid.tsx`
  - [ ] 使用 CSS Grid（响应式：1 列 → 2 列 → 3-4 列）
  - [ ] 接受 `accounts: AccountModel[]` 数组
  - [ ] 遍历渲染 AccountCard 组件

### 2.2 首页主容器
- [ ] 创建 `frontend/src/components/accounts/AccountSelector.tsx`（首页主组件）
  - [ ] 从 Zustand Store 读取 `accounts`, `loading`, `error`
  - [ ] 显示欢迎标题："选择你的云存储账户"
  - [ ] 根据账户状态显示：
    - [ ] 无账户 → 显示欢迎提示 + "新建账户"按钮
    - [ ] 有账户 → 使用 AccountCardGrid 展示
  - [ ] "新建账户"按钮 → 打开 AccountFormDrawer（创建模式）
  - [ ] 加载中 → 显示骨架屏或加载动画
  - [ ] 错误 → 显示错误信息和重试按钮

- [ ] 集成首页到 HomePage.tsx
  - [ ] HomePage 使用 HomeLayout，主内容为 AccountSelector
  - [ ] 验证导出/导入按钮在页面上方可用

### 2.3 路由导航逻辑
- [ ] 更新 App.tsx 或 routing.ts
  - [ ] 实现自动导航逻辑：
    - [ ] 首次进入 `/` → 调用 `bootstrap()`
    - [ ] 如果 activeAccountId 存在 → 立即重定向到 `/accounts/[id]/dashboard`
    - [ ] 否则停留在 `/`（无账户或多账户选择）
  - [ ] 使用 `useEffect` + `useNavigate()` 实现

- [ ] 测试各种场景
  - [ ] 无账户：停留在首页，显示欢迎提示
  - [ ] 一个账户：自动跳转到 Dashboard
  - [ ] 多个账户：显示选择器

---

## Phase 3: Dashboard 与账户切换（优先级：⭐⭐⭐⭐⭐）

### 3.1 Sidebar 账户切换器
- [ ] 创建 `frontend/src/components/accounts/AccountSwitcher.tsx`
  - [ ] 显示所有账户的竖向列表
  - [ ] 当前活跃账户高亮显示（加粗 / 背景色）
  - [ ] 点击切换账户 → 调用 `setActiveAccount(id)`
  - [ ] 可选：悬停显示账户 Endpoint 预览
  - [ ] 分隔线分开账户列表和系统菜单

### 3.2 Sidebar 系统菜单
- [ ] 改进 Sidebar.tsx
  - [ ] 顶部：AccountSwitcher
  - [ ] 底部：分隔线
  - [ ] 系统设置链接 → 跳转 `/settings`
  - [ ] 主题切换按钮（深/浅模式）
  - [ ] 帮助与反馈链接（可选，指向文档）

### 3.3 Dashboard 页面
- [ ] 创建 Dashboard 主容器组件
  - [ ] 显示当前活跃账户信息（Name, Provider, Endpoint）
  - [ ] 在主内容区渲染 BucketBrowser 和 ObjectBrowser
  - [ ] 保持现有布局（Bucket 左上，Object 右侧）

- [ ] 改进 DashboardLayout
  - [ ] 左侧集成 Sidebar
  - [ ] 右侧主内容（BucketBrowser + ObjectBrowser）
  - [ ] 响应式：移动端 Sidebar 收起为汉堡菜单（可选）

### 3.4 Dashboard Header 功能
- [ ] 保留现有 Header
  - [ ] 显示当前账户名称、Provider、Region
  - [ ] "刷新"按钮 → 重新加载 Bucket 列表
  - [ ] "测试连接"按钮 → 测试当前账户连接（新功能，见 3.5）
  - [ ] "编辑账户"按钮 → 打开 AccountFormDrawer（编辑模式）
  - [ ] "导入/导出"按钮保持可用

### 3.5 连接测试按钮与反馈
- [ ] 创建 `frontend/src/components/accounts/ConnectionTestButton.tsx`
  - [ ] Props: `accountId: string`
  - [ ] 点击触发 `accountsStore.testConnection(accountId)`
  - [ ] 显示实时状态
    - [ ] 加载中 → 按钮显示加载动画，禁用
    - [ ] 成功 → 绿色文字，显示"连接正常"
    - [ ] 失败 → 红色文字，显示"连接异常"和错误详情
  - [ ] 可选：显示最后检测时间

- [ ] 集成到 Dashboard Header
  - [ ] 测试连接按钮位置在"刷新"和"编辑账户"之间
  - [ ] 点击按钮后，结果显示在 Header 下方或 Toast 中

### 3.6 测试与集成
- [ ] 功能测试
  - [ ] Dashboard 加载：正确显示账户信息和 Bucket 列表
  - [ ] 切换账户：Sidebar 点击不同账户，Dashboard 正确更新
  - [ ] 测试连接：按钮显示正确状态，连接结果反馈准确
  - [ ] 页面刷新：重新加载后 activeAccountId 正确恢复
  - [ ] 回到首页：从 Dashboard 导航回首页，选择器正确显示

---

## Phase 4: 账户创建/编辑 - 测试连接集成（优先级：⭐⭐⭐⭐）

### 4.1 改进 AccountFormDrawer
- [ ] 编辑 `frontend/src/components/accounts/AccountFormDrawer.tsx`
  - [ ] 添加 `testingConnection` 状态
  - [ ] 添加 `connectionTestResult` 状态（ConnectionProbe 对象）

- [ ] 添加表单验证
  - [ ] 必填字段（Account Name, Provider, Endpoint, AccessKey, SecretKey）
  - [ ] Endpoint 格式校验（URL 格式）
  - [ ] 禁用提交直到表单有效

### 4.2 测试连接步骤
- [ ] 在表单下方添加"测试连接"按钮
  - [ ] 仅当表单字段都有效时启用
  - [ ] 点击触发测试（参考 FRONTEND_REDESIGN_PLAN.md 第 9.2 节）
  - [ ] 进行中显示加载动画
  - [ ] 结果显示在表单下方
    - [ ] 成功 → 绿色背景，"连接成功"
    - [ ] 失败 → 红色背景，显示错误信息

### 4.3 条件保存
- [ ] Dialog 底部"保存"按钮
  - [ ] 未测试连接 → 禁用 + 提示"请先测试连接"
  - [ ] 测试成功 → 启用
  - [ ] 测试失败 → 禁用 + 提示"请修复配置后重试"

- [ ] 允许用户返回修改
  - [ ] 测试失败后，用户可修改表单字段
  - [ ] 清除之前的测试结果（可选）
  - [ ] 重新测试新配置

### 4.4 保存流程
- [ ] "保存"按钮点击后
  - [ ] 调用 `createAccount()` 或 `updateAccount()`
  - [ ] 显示加载动画
  - [ ] 成功 → 关闭 Dialog，刷新账户列表，显示 Toast 成功提示
  - [ ] 失败 → 显示错误信息，保持 Dialog 打开，允许重试

### 4.5 测试
- [ ] 单元测试：表单验证逻辑
- [ ] 集成测试：
  - [ ] 创建账户流程（表单 → 测试 → 保存 → 首页显示）
  - [ ] 编辑账户流程
  - [ ] 测试失败时无法保存
  - [ ] 连接超时处理（3s 超时提示）

---

## Phase 5: 系统设置页面（优先级：⭐⭐⭐）

### 5.1 创建设置页面框架
- [x] 编辑 `frontend/src/pages/SettingsPage.tsx`
  - [x] 左侧菜单（可选）或单页设置
  - [x] 各功能模块分组显示

### 5.2 主题与显示设置
- [x] 添加亮/暗/系统主题切换选项
  - [x] 读取当前主题状态
  - [x] 点击切换 → 更新 `document.documentElement.classList`
  - [x] 保存到 localStorage，刷新时恢复（`can:theme-preference`）

### 5.3 导入/导出功能
- [x] 添加导出按钮
  - [x] 点击 → 调用 `accountsStore.exportAccounts()`
  - [x] 显示导出结果（文件路径、账户数量）

- [x] 添加导入按钮
  - [x] 点击 → 调用 `accountsStore.importAccounts()`
  - [x] 显示导入结果摘要（导入成功/失败数、问题列表）

### 5.4 关于应用
- [x] 显示应用版本号（从 `wails.json`/环境变量获取）
- [x] 帮助文档链接（重构计划 / 实现清单 / 速查表）
- [x] 反馈或社区链接（GitHub Issues）

### 5.5 高级选项（可选）
- [x] 数据库驱动选择（SQLite / Memory）
- [x] 日志级别设置（Debug / Info / Warn / Error，保存在 `can:advanced-settings`）

---

## Phase 6: UI 完善与响应式适配（优先级：⭐⭐⭐）

### 6.1 响应式布局
- [ ] 测试所有页面在不同设备宽度
  - [ ] 移动端 (320px): 首页 1 列，Sidebar 隐藏
  - [ ] 平板 (768px): 首页 2 列，Sidebar 可见或可展开
  - [ ] 桌面 (1024px+): 首页 3-4 列，Sidebar 常显

- [ ] Sidebar 移动端处理
  - [ ] 可选：实现汉堡菜单（< 768px）
  - [ ] 点击汉堡打开侧滑菜单
  - [ ] 点击菜单项或外部关闭菜单

### 6.2 加载状态优化
- [ ] 首页加载账户列表时显示骨架屏
- [ ] Dashboard 切换账户时显示进度指示
- [ ] 表单提交时禁用按钮并显示加载动画

### 6.3 错误处理与提示
- [ ] 网络错误：显示重试按钮
- [ ] 表单错误：显示具体错误信息
- [ ] 成功操作：显示 Toast 提示（1.5s 自动消失）

### 6.4 可访问性改进（可选）
- [ ] 添加 ARIA 标签
- [ ] 按钮焦点状态
- [ ] 键盘导航支持

---

## Phase 7: 测试与质量保证（优先级：⭐⭐⭐⭐）

### 7.1 单元测试
- [ ] 测试 Zustand Store
  - [ ] `bootstrap()` 正确加载数据
  - [ ] `setActiveAccount()` 更新状态
  - [ ] `testConnection()` 返回正确结果
  - [ ] 错误处理和异常情况

- [ ] 测试组件逻辑
  - [ ] AccountCard 点击导航正确
  - [ ] AccountFormDrawer 表单验证
  - [ ] AccountSwitcher 账户切换

### 7.2 集成测试
- [ ] 路由导航流程
  - [ ] 首页 → 选择账户 → Dashboard
  - [ ] Dashboard → 切换账户 → 正确加载新数据
  - [ ] Dashboard → 返回首页 → 保持选择器状态

- [ ] 账户生命周期
  - [ ] 创建账户（测试连接 → 保存）
  - [ ] 编辑账户
  - [ ] 删除账户
  - [ ] 导入/导出

### 7.3 UI/UX 测试
- [ ] 表单验证
  - [ ] 必填字段检查
  - [ ] 格式验证
  - [ ] 错误提示清晰

- [ ] 连接测试
  - [ ] 成功场景反馈清晰
  - [ ] 失败场景显示错误详情
  - [ ] 超时处理（3s 超时后显示提示）

- [ ] 响应式布局
  - [ ] 移动端（≤ 576px）
  - [ ] 平板（577px-992px）
  - [ ] 桌面（> 992px）

### 7.4 浏览器兼容性
- [ ] Chrome/Edge 最新版本
- [ ] Firefox 最新版本
- [ ] Safari（如支持）

### 7.5 性能优化
- [ ] 首页加载时间 < 2s
- [ ] 账户切换延迟 < 1s
- [ ] 避免不必要的重渲染（React DevTools Profiler）

---

## Phase 8: 文档与部署（优先级：⭐⭐）

### 8.1 代码文档
- [ ] 为新组件添加 JSDoc 注释
  - [ ] Props 接口说明
  - [ ] 返回值说明
  - [ ] 使用示例

- [ ] Store 方法文档
  - [ ] 参数说明
  - [ ] 返回值说明
  - [ ] 错误处理说明

### 8.2 用户文档
- [ ] 更新 README.md
  - [ ] 新的首页选择器说明
  - [ ] 连接测试功能说明
  - [ ] 系统设置位置

### 8.3 部署检查清单
- [ ] 确保所有依赖已安装：`pnpm install --frozen-lockfile --dir frontend`
- [ ] 前端构建成功：`pnpm --dir frontend build`
- [ ] 完整应用构建成功：`wails build`
- [ ] 本地测试通过：`wails dev`
- [ ] Git 提交记录清晰（遵循 AGENTS.md 指南）

---

## 任务依赖关系

```
Phase 1 (基础架构) 
    ↓
Phase 2 (首页)
    ↓
Phase 3 (Dashboard + 切换) 
    ↓
Phase 4 (账户创建改进)
    ↓
Phase 5 (设置页面)
    ↓
Phase 6 (UI 完善)
    ↓
Phase 7 (测试)
    ↓
Phase 8 (部署)
```

各 Phase 内的任务可并行完成，但 Phase 之间需按顺序。

---

## 进度跟踪

### 总体进度
- 总任务数：45+
- 已完成：0
- 进行中：0
- 待完成：45+

### 按优先级统计
| 优先级 | 任务数 | 完成数 | 进度 |
|-------|--------|--------|------|
| ⭐⭐⭐⭐⭐ | 18 | 0 | 0% |
| ⭐⭐⭐⭐ | 10 | 0 | 0% |
| ⭐⭐⭐ | 12 | 0 | 0% |
| ⭐⭐ | 5 | 0 | 0% |

---

## 完成与提交

- 完成每个 Phase 后，更新本清单的复选框
- 确保所有单元测试和集成测试通过
- 验证构建成功：`pnpm --dir frontend build && wails build`
- 提交代码变更到 git（清晰的提交信息）
- 更新本文档的进度统计

---

## 常见问题与提示

### Q: 如何测试路由逻辑？
A: 使用 React Router DevTools（浏览器扩展）或手动导航到 URL：
- `http://localhost:5173/` - 首页
- `http://localhost:5173/accounts/[account-id]/dashboard` - Dashboard
- `http://localhost:5173/settings` - 设置页面

### Q: 如何调试 Zustand Store？
A: 在浏览器 DevTools 中，检查 `window.accountsStore` 状态，或使用 `redux-devtools` 中间件

### Q: 测试连接超时如何处理？
A: 在 `testConnection()` 中添加 3s 超时，超时后返回错误状态

### Q: 如何保证用户刷新页面后数据不丢失？
A: `bootstrap()` 会在 App 挂载时自动调用，恢复所有账户数据和活跃账户

### Q: 旧的 App.tsx 中的逻辑怎么办？
A: 逐个迁移到新的页面组件中，或提取为可复用的 Hook

---

## 相关资源

- [前端重新设计详细计划](./FRONTEND_REDESIGN_PLAN.md)
- [账户管理规范](./spec/account_management_multi_account.md)
- [项目开发指南](../AGENTS.md)
- [React Router 文档](https://reactrouter.com/)
- [Zustand 文档](https://github.com/pmndrs/zustand)

---

## 最后更新

**日期**: 2025-12-04  
**版本**: v2.0
**变更**: 切换至 TanStack Router，移除 PR 流程相关内容
