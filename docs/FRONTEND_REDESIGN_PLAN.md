# 前端重新规划文档

## 概述

本文档详细规划了 CAN 前端应用的架构重新设计，目标是优化用户流程、改进数据持久化，并提供更清晰的导航体验。

---

## 一、现状分析

### 当前问题
1. **首页集成过多功能**：主页面集合了账户创建、Bucket 浏览、对象操作等多个功能，信息密集
2. **数据持久化缺陷**：用户创建账户后，页面刷新会丢失数据（虽然后端已保存，但前端状态未正确恢复）
3. **账户选择不直观**：侧边栏中的账户选择与操作混在一起，用户体验不清晰
4. **测试连接位置不够明显**：测试连接按钮在主页面顶部，用户在创建账户时无法直接测试
5. **路由方案需升级**：当前使用基础路由，需要切换到 TanStack Router 以获得更好的类型安全和性能

### 后端现状
- ✅ 账户数据已持久化到 SQLite
- ✅ 支持账户 CRUD 操作
- ✅ 实现连接测试功能
- ✅ 会话恢复机制就位
- ✅ 导入/导出功能完整

---

## 二、新设计架构

### 2.1 路由结构

```
/
├── /accounts
│   └── /accounts/[accountId]/dashboard    # 供应商仪表盘
├── /settings                               # 系统设置
└── /[defaultAccount]/dashboard             # 重定向到默认账户dashboard
```

### 2.2 页面层级与用途

#### 1. 首页 (`/`) - 账户选择中心
**目的**：供应商账户选择器，用户首次打开应用的入口

**布局**：
- 头部：应用 Logo + 主标题（"选择你的云存储账户"）
- 主区域：账户卡片网格展示
  - 每个卡片显示：供应商图标、账户名称、Provider 类型、连接状态
  - 点击卡片进入该账户的 Dashboard
  - 连接状态：绿色（OK）/ 红色（Error）/ 灰色（Pending）
- 底部操作栏：
  - "+ 新建账户" 按钮 → 打开账户创建 Dialog
  - 系统设置图标 → 跳转 `/settings`
  - 导入/导出按钮

**状态处理**：
- 如果没有任何账户：显示欢迎提示 + "新建账户"按钮
- 如果有多个账户：从本地存储加载并展示（默认选中上次活跃账户）
- 自动跳转：如果是首次有且仅有一个账户，自动跳转到该账户 Dashboard

#### 2. 账户 Dashboard (`/accounts/[accountId]/dashboard`) - 供应商管理中心
**目的**：用户操作某个特定账户的主工作区

**布局**：
```
┌─ Header ─────────────────────────────────────┐
│ 账户名称 / 供应商类型 / Endpoint              │
│ [测试连接] [编辑账户] [其他操作]              │
└───────────────────────────────────────────────┘
┌─ Left Sidebar (220px) ─┬─ Main Content ──────┐
│                        │                      │
│ 账户切换器              │ Bucket Browser      │
│ [账户A] ✓              │ (左上)               │
│ [账户B]                │                      │
│ [账户C]                │ Object Browser      │
│ ──────────             │ (右侧 lg:col-span-2)│
│ System Settings        │                      │
│ Help & Support         │                      │
│                        │                      │
└────────────────────────┴──────────────────────┘
```

**功能说明**：
- **Header**：显示当前账户信息、快速操作按钮
  - 测试连接按钮：实时显示连接状态
  - 编辑账户按钮：修改账户配置
  - 刷新按钮：手动刷新 Bucket 列表
  - 其他操作（导出当前账户配置等）
  
- **Sidebar 账户切换器**：
  - 竖向列表展示所有账户
  - 当前活跃账户高亮
  - 点击切换账户（触发 `SetActiveAccount` 并重新加载 Bucket 列表）
  - 支持悬停显示账户详情（Endpoint 预览）
  
- **Sidebar 系统设置**：
  - 主题切换（深/浅模式）
  - 导入/导出配置
  - 关于应用
  - 帮助文档

- **Main Content**：保留现有布局（Bucket + Object Browser）

#### 3. 账户创建/编辑 Dialog - 侧边抽屉表单
**目的**：创建或编辑账户配置

**流程**：
1. **表单填写阶段**
   - Provider 选择（下拉 / 单选框）
   - 账户名称输入
   - Endpoint、AccessKey、SecretKey 输入
   - Region、Port、SSL 设置
   - 表单验证（必填字段、格式校验）

2. **测试连接阶段**
   - 表单填写完成后显示"测试连接"按钮
   - 点击触发 `TestAccountConnection`
   - 显示实时状态：加载中 → 成功/失败
   - **重要**：仅在连接成功后才允许保存账户

3. **保存阶段**
   - 连接成功后，"保存"按钮激活
   - 调用 `CreateAccount` 或 `UpdateAccount`
   - 关闭 Dialog，刷新账户列表
   - 若是新建，自动激活该账户

**设计要点**：
- 使用 React Context 或 Zustand 管理表单状态
- 分步骤展示（可选：Introduction → Form → Test → Success）
- 实时反馈错误信息
- 连接测试失败时显示详细错误，允许用户返回修改

#### 4. 系统设置页面 (`/settings`)
**目的**：应用全局配置管理

**功能模块**：
- **主题与显示**：亮/暗/系统主题切换（首选项保存在 `localStorage: can:theme-preference` 并自动同步 `document.documentElement`）
- **导入/导出**
  - 导出所有账户配置
  - 导入账户配置文件
  - 显示导入结果摘要
- **高级选项**
  - 数据库驱动（SQLite / Memory）
  - 日志级别（Debug / Info / Warn / Error）
  - 仅在本地保存（`localStorage: can:advanced-settings`），用于实验配置
- **关于应用**
  - 版本号
  - 更新日志 / 规范链接
  - 帮助文档入口
  - 反馈通道（GitHub Issues）

---

## 三、数据流与持久化

### 3.1 账户数据生命周期

```
创建/编辑表单
    ↓
用户填写信息
    ↓
点击"测试连接"
    ↓
前端调用 TestAccountConnection(id)
    ↓ (Go 后端验证)
    ↓
返回结果 (success/error)
    ↓
连接成功 → 显示"保存"按钮
    ↓
用户点击"保存"
    ↓
前端调用 CreateAccount / UpdateAccount
    ↓ (Go 后端持久化到 SQLite)
    ↓
返回保存后的账户数据
    ↓
前端更新 Zustand Store
    ↓
关闭 Dialog，刷新 UI
```

### 3.2 前端状态管理 (Zustand)

**Store 结构优化**：
```typescript
interface AccountsState {
  // 账户数据
  accounts: AccountModel[]
  activeAccountId: string | null
  
  // 查询状态
  loading: boolean
  error: string | null
  
  // 连接测试状态
  connectionTests: Record<string, ConnectionProbe>
  
  // 操作方法
  bootstrap: () => Promise<void>
  listAccounts: () => Promise<void>
  createAccount: (input: CreateAccountInput) => Promise<AccountModel>
  updateAccount: (id: string, input: UpdateAccountInput) => Promise<AccountModel>
  deleteAccount: (id: string) => Promise<void>
  setActiveAccount: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<ConnectionProbe>
}
```

**初始化流程**：
1. App 挂载 → 调用 `bootstrap()`
2. `bootstrap()` 调用后端 `ListAccounts()` → 获取所有账户
3. 调用后端 `ActiveAccount()` → 获取上次活跃账户
4. 如果没有 activeAccount，自动设置第一个账户为活跃
5. 恢复首页已选择账户或自动跳转到 Dashboard

### 3.3 会话恢复机制

**后端保证**：
- Go 侧维护 `Service.activeAccountId` 
- 应用启动时自动从 SQLite 恢复

**前端保证**：
- 页面刷新时调用 `bootstrap()` 恢复账户列表和活跃账户
- 使用 `localStorage` 缓存（可选）：最后活跃账户 ID，加快加载速度

---

## 四、UI 组件清单

### 新增组件

| 组件名 | 位置 | 说明 |
|-------|-----|------|
| `ProviderSelector` | `/components/accounts/` | 供应商选择器（单选 / 下拉） |
| `AccountCard` | `/components/accounts/` | 首页账户卡片 |
| `AccountCardGrid` | `/components/accounts/` | 首页账户卡片网格容器 |
| `AccountSwitcher` | `/components/sidebar/` | Sidebar 中的账户切换列表 |
| `ConnectionTestButton` | `/components/accounts/` | 测试连接按钮（带状态反馈） |
| `TestConnectionModal` | `/components/accounts/` | 测试连接结果弹窗（可选）|
| `SettingsPage` | `/components/settings/` | 系统设置页面 |
| `HomeLayout` | `/components/layouts/` | 首页布局 |
| `DashboardLayout` | `/components/layouts/` | Dashboard 布局 |

### 改进现有组件

| 组件名 | 改进点 |
|-------|------|
| `AccountFormDrawer` | 添加"测试连接"步骤，仅连接成功后允许保存 |
| `AccountSidebar` | 改为 Sidebar，新增账户切换器和设置入口 |
| `BucketBrowser` | 保持不变，作为 Dashboard 主内容 |
| `ObjectBrowser` | 保持不变，作为 Dashboard 主内容 |

---

## 五、路由与导航

### 5.1 路由配置

使用 TanStack Router（React Router 的官方演进，提供更强大的类型安全和文件系统路由支持）：

```typescript
// frontend/src/routes/root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: Outlet,
})

// frontend/src/routes/index.tsx (首页路由)
import { createFileRoute } from '@tanstack/react-router'
import HomePage from '@/pages/HomePage'

export const Route = createFileRoute('/')({
  component: HomePage,
})

// frontend/src/routes/accounts/$accountId.dashboard.tsx (Dashboard 路由)
import { createFileRoute } from '@tanstack/react-router'
import DashboardPage from '@/pages/DashboardPage'

export const Route = createFileRoute('/accounts/$accountId/dashboard')({
  component: DashboardPage,
})

// frontend/src/routes/settings.tsx (设置路由)
import { createFileRoute } from '@tanstack/react-router'
import SettingsPage from '@/pages/SettingsPage'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})
```

### 5.2 导航规则

- **首次访问**
  - 无账户 → 停留在 `/`，提示创建账户
  - 有一个账户 → 自动重定向到 `/accounts/[id]/dashboard`
  - 有多个账户 → 显示首页选择器

- **用户操作**
  - 从首页点击账户卡片 → 跳转到 `/accounts/[id]/dashboard`
  - 从 Dashboard 点击 Sidebar 账户 → 切换到新账户（保留在 Dashboard）
  - 点击系统设置 → 导航到 `/settings`
  - 从 Dashboard 回到首页 → 显示账户选择器

---

## 六、API 接口使用

### 后端 Wails Bindings（现有，无需修改）

```go
// 账户操作
ListAccounts() ([]Account, error)
CreateAccount(input CreateAccountInput) (Account, error)
UpdateAccount(id string, input UpdateAccountInput) (Account, error)
DeleteAccount(id string) error
SetActiveAccount(id string) (Account, error)
ActiveAccount() (*Account, error)

// 测试连接
TestAccountConnection(id string) (ConnectionTestResult, error)

// 导入/导出
ExportAccounts() (ExportSummary, error)
ImportAccounts() (ImportSummary, error)

// Bucket 和 Object 操作（保持不变）
ListBuckets(accountID string) ([]BucketInfo, error)
ListObjects(accountID string, input ListObjectsInput) (ListObjectsResult, error)
// ... 其他操作
```

### 前端调用约定

- 所有网络操作通过 Zustand Store 的 action 方法
- 错误统一在 Store 中处理，展示为 toast 或页面错误提示
- 加载状态由 Store 管理，UI 组件订阅显示加载动画

---

## 七、实现优先级与任务清单

### Phase 1: 基础架构（必须）
- [ ] 添加 React Router 依赖和路由配置
- [ ] 创建 `HomeLayout` 和 `DashboardLayout` 组件框架
- [ ] 实现账户选择首页（`/` 路由）
  - [ ] `AccountCard` 组件
  - [ ] `AccountCardGrid` 容器
  - [ ] 首页初始加载逻辑
- [ ] 改进 Zustand Store（添加 `activeAccountId` 管理）
- [ ] 实现会话恢复：`bootstrap()` 方法

### Phase 2: 核心功能（必须）
- [ ] 改进 `AccountFormDrawer`
  - [ ] 添加"测试连接"按钮
  - [ ] 连接成功前禁用保存
  - [ ] 显示连接结果反馈
- [ ] 创建 `ConnectionTestButton` 组件（Dashboard 中使用）
- [ ] 改进 Sidebar
  - [ ] `AccountSwitcher` 列表组件
  - [ ] 账户快速切换逻辑
  - [ ] 设置入口
- [ ] Dashboard 页面框架（`/accounts/:accountId/dashboard`）
- [ ] 自动导航逻辑（首页跳转 Dashboard 或停留在首页）

### Phase 3: 增强功能（可选）
- [ ] 创建 `/settings` 页面
  - [ ] 主题切换
  - [ ] 导入/导出按钮
  - [ ] 关于应用
- [ ] 添加 `TestConnectionModal` 或改进现有反馈方式
- [ ] 优化首页加载性能（延迟加载账户状态）
- [ ] 添加账户搜索/筛选（if 账户众多）

### Phase 4: 测试与优化（必须）
- [ ] 单元测试：Zustand Store 方法
- [ ] 集成测试：路由导航、账户切换
- [ ] UI 测试：表单验证、错误处理
- [ ] 性能优化：避免不必要的重渲染
- [ ] 跨浏览器兼容性测试

---

## 八、UX 考虑事项

### 加载状态
- 首页加载账户列表时显示骨架屏
- Dashboard 切换账户时显示加载进度
- 测试连接时显示实时反馈（3s 超时提示）

### 错误提示
- 账户创建失败 → Dialog 底部显示错误信息
- 连接测试失败 → 弹窗或 toast 显示详细错误
- 网络错误 → 重试机制

### 反馈与确认
- 删除账户前显示确认对话框
- 切换账户时，如果有未保存的操作，显示提示
- 成功操作后显示 toast（1.5s 消失）

### 响应式设计
- 移动端：Sidebar 收起为 Hamburger 菜单
- 首页账户卡片：1 列（移动）→ 2 列（平板）→ 3-4 列（桌面）
- Dashboard：保持现有响应式布局

---

## 九、代码示例

### 示例 1：Zustand Store 优化后的 bootstrap

```typescript
const accountsStore = create<AccountsState>((set) => ({
  // ... 其他状态
  
  bootstrap: async () => {
    set({ loading: true, error: null })
    try {
      const accounts = await window.go.main.App.ListAccounts()
      const activeAccount = await window.go.main.App.ActiveAccount()
      
      set({
        accounts,
        activeAccountId: activeAccount?.id ?? accounts[0]?.id ?? null,
        loading: false
      })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  }
}))
```

### 示例 2：账户创建 Dialog 中的测试连接

```typescript
const [testResult, setTestResult] = useState<ConnectionProbe | null>(null)

const handleTestConnection = async () => {
  if (!formData) return
  
  setTesting(true)
  try {
    const result = await accountsStore.testConnection(formData.id || '')
    setTestResult(result)
  } catch (err) {
    setTestResult({
      status: 'error',
      message: (err as Error).message,
      checkedAt: new Date().toISOString()
    })
  } finally {
    setTesting(false)
  }
}

const canSave = testResult?.status === 'ok'

// 在 Dialog 底部
{testResult && (
  <div className={cn(
    'p-3 rounded-md text-sm',
    testResult.status === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
  )}>
    {testResult.message || (testResult.status === 'ok' ? '连接成功' : '连接失败')}
  </div>
)}
```

### 示例 3：首页账户卡片

```typescript
function AccountCard({ account }: { account: AccountModel }) {
  const connectionProbe = useAccountsStore((s) => s.connectionTests[account.id])
  const navigate = useNavigate()
  
  const connectionColor = 
    connectionProbe?.status === 'ok' ? 'bg-green-100' :
    connectionProbe?.status === 'error' ? 'bg-red-100' :
    'bg-gray-100'
  
  return (
    <Card 
      className="cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate(`/accounts/${account.id}/dashboard`)}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{account.name}</h3>
          <p className="text-sm text-muted-foreground">{account.providerLabel}</p>
        </div>
        <div className={cn('w-3 h-3 rounded-full', connectionColor)} />
      </div>
      <p className="text-xs text-muted-foreground mt-2">{account.endpoint}</p>
    </Card>
  )
}
```

---

## 十、文件结构变化

```
frontend/src/
├── components/
│   ├── accounts/
│   │   ├── AccountCard.tsx                  [新]
│   │   ├── AccountCardGrid.tsx              [新]
│   │   ├── AccountFormDrawer.tsx            [改进]
│   │   ├── AccountSidebar.tsx               [改进 → Sidebar]
│   │   ├── AccountSwitcher.tsx              [新]
│   │   ├── ConnectionTestButton.tsx         [新]
│   │   └── ProviderSelector.tsx             [新]
│   ├── layouts/
│   │   ├── HomeLayout.tsx                   [新]
│   │   ├── DashboardLayout.tsx              [新]
│   │   └── Sidebar.tsx                      [新/重构]
│   ├── settings/
│   │   └── SettingsPage.tsx                 [新]
│   ├── buckets/
│   │   └── BucketBrowser.tsx                [保持]
│   ├── objects/
│   │   └── ObjectBrowser.tsx                [保持]
│   └── ui/
│       └── ...                              [保持]
├── pages/
│   ├── HomePage.tsx                         [新]
│   ├── DashboardPage.tsx                    [新]
│   └── SettingsPage.tsx                     [新]
├── lib/
│   └── routing.ts                           [新 - 路由配置]
├── state/
│   └── accounts.ts                          [改进 - 优化 Store]
├── App.tsx                                  [改为路由容器]
├── App.css                                  [保持]
└── main.tsx                                 [保持]
```

---

## 十一、测试用例

### 单元测试

- `accountsStore.bootstrap()` → 正确加载账户列表和活跃账户
- `accountsStore.setActiveAccount(id)` → 更新活跃账户 ID
- `accountsStore.testConnection(id)` → 返回正确的连接状态
- 错误处理：网络超时、无效凭证

### 集成测试

- 首页 → 选择账户 → Dashboard 导航
- Dashboard → 切换账户 → 正确加载新账户的 Buckets
- 创建账户 → 测试连接 → 保存 → 首页显示新账户
- 删除账户 → 自动切换到其他账户或回到首页

### UI 测试

- 表单必填字段验证
- 连接失败时无法保存
- 首页无账户时显示欢迎提示
- 响应式布局在不同设备上的表现

---

## 十二、注意事项与风险

### 安全性
- 敏感信息（Secret Key）不应显示在首页卡片中
- 测试连接前确保表单字段有效，防止恶意请求

### 性能
- 首页如果账户数量过多（>50），考虑虚拟滚动或分页
- Dashboard 切换账户时，缓存已加载的 Bucket 列表

### 兼容性
- 确保 localStorage 可用（用于缓存活跃账户 ID）
- React Router v6+ 兼容性

### 迁移策略
- 现有账户数据保持不变（后端 SQLite 已保存）
- 前端重新部署后，自动调用 `bootstrap()` 恢复状态
- 无需数据库迁移或用户操作

---

## 十三、后续维护与扩展

### 可选增强
1. **账户分组**：为账户添加标签或分组功能
2. **最近操作记录**：首页显示最近访问的账户或操作
3. **快捷操作**：首页卡片长按或右键菜单（复制 Endpoint、编辑等）
4. **账户搜索/筛选**：根据名称、Provider 类型搜索
5. **深链接**：支持 `/accounts/[id]/dashboard` 直接访问

### 监控指标
- 首页加载时间
- 账户切换延迟
- 连接测试成功率
- 用户操作完成率（创建 → 测试 → 保存）

---

## 附录：关键决策说明

### 为什么分离首页和 Dashboard？
- **用户心智模型**：首页是"选择"，Dashboard 是"工作"
- **降低认知负担**：用户创建账户后立即进入工作区
- **扩展性**：未来可为不同供应商定制 Dashboard 布局

### 为什么要求连接测试成功才能保存？
- **用户保护**：避免保存无效的凭证，浪费后续诊断时间
- **体验优化**：及时反馈配置错误，而不是在 Bucket 列表加载时失败
- **数据质量**：确保存储的所有账户都是有效的

### 为什么使用 Zustand？
- 轻量级，无额外依赖
- 支持中间件和 DevTools
- 易于测试和维护

### 为什么不使用全局状态管理用户选择的供应商？
- 用户选择是临时状态（仅在创建或编辑时有效）
- Dialog 本地状态足以满足需求
- 避免状态污染

### 为什么选择 TanStack Router？
- 类型安全：路由参数自动类型推导
- 文件系统路由：直观的项目结构
- 性能优化：按需加载，预加载支持
- 非侵入式：不依赖特定框架特性
- 官方演进：由 React Router 核心团队维护

---

## 版本历史

| 版本 | 日期 | 变化 |
|-----|------|------|
| v1.0 | 2025-12-04 | 初稿：完整设计方案 |

---

## 相关文档

- [账户管理规范](./spec/account_management_multi_account.md)
- [UI 导航规范](./spec/ui_navigation_interaction.md)
- [AGENTS.md](../AGENTS.md) - 项目开发指南
