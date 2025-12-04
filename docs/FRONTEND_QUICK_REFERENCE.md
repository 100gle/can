# 前端重新设计 - 快速参考指南

本文档为开发人员提供快速查找和参考的内容，包括核心概念、代码模板和常见操作。

---

## 架构概览（一张图）

```
┌─────────────────────────────────────────────────────────────┐
│                         App (Router)                         │
└─────────────────────────────────────────────────────────────┘
  ├─ Route: "/"
  │  └─ HomeLayout
  │     └─ HomePage
  │        └─ AccountSelector
  │           └─ [AccountCard × N] (Grid)
  │
  ├─ Route: "/accounts/:accountId/dashboard"
  │  └─ DashboardLayout
  │     ├─ Sidebar (Left)
  │     │  ├─ AccountSwitcher
  │     │  └─ SettingsMenu
  │     └─ Dashboard (Right)
  │        ├─ Header (with TestConnectionButton)
  │        ├─ BucketBrowser
  │        └─ ObjectBrowser
  │
  └─ Route: "/settings"
     └─ SettingsPage
        ├─ Theme Settings
        ├─ Import/Export
        └─ About
```

---

## 核心数据流

### 1. 初始化流程
```
App 挂载
  ↓
App.useEffect 调用 accountsStore.bootstrap()
  ↓
bootstrap() {
  - 调用后端 ListAccounts()
  - 调用后端 ActiveAccount()
  - 更新 Store 状态
}
  ↓
如果 activeAccountId 存在
  → 重定向到 /accounts/[id]/dashboard
否则
  → 停留在 / (首页)
```

### 2. 账户创建流程
```
用户点击 "新建账户"
  ↓
打开 AccountFormDrawer (mode: create)
  ↓
用户填写表单
  ↓
用户点击 "测试连接"
  ↓
accountsStore.testConnection(accountId)
  ↓
后端验证连接
  ↓
连接成功 → "保存"按钮启用
连接失败 → 显示错误，允许修改
  ↓
用户修改表单或重新测试
  ↓
用户点击 "保存"
  ↓
accountsStore.createAccount(input)
  ↓
后端保存到 SQLite
  ↓
返回保存的账户数据
  ↓
Store 更新，Dialog 关闭，首页刷新
```

### 3. 账户切换流程
```
用户在 Sidebar 点击其他账户
  ↓
触发 AccountSwitcher 的 onClick
  ↓
调用 accountsStore.setActiveAccount(accountId)
  ↓
后端更新活跃账户 ID
  ↓
Store 更新 activeAccountId
  ↓
Dashboard 自动重新加载该账户的 Buckets
  ↓
UI 反映新的账户信息
```

---

## Zustand Store 快速参考

### State 结构
```typescript
interface AccountsState {
  // 数据
  accounts: AccountModel[]              // 所有账户列表
  activeAccountId: string | null        // 当前活跃账户 ID
  providers: ProviderMetadata[]         // 支持的供应商列表
  
  // 状态标志
  loading: boolean                      // 加载中
  error: string | null                  // 错误信息
  
  // 连接测试缓存
  connectionTests: Record<string, ConnectionProbe>
  
  // 操作方法
  bootstrap: () => Promise<void>
  listAccounts: () => Promise<void>
  createAccount: (input: CreateAccountInput) => Promise<AccountModel>
  updateAccount: (id: string, input: UpdateAccountInput) => Promise<AccountModel>
  deleteAccount: (id: string) => Promise<void>
  setActiveAccount: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<ConnectionProbe>
  refresh: () => Promise<void>
  exportAccounts: () => Promise<ExportSummary>
  importAccounts: () => Promise<ImportSummary>
}
```

### 常用操作

**在组件中使用 Store**：
```typescript
import { useAccountsStore } from '@/state/accounts'

function MyComponent() {
  const { accounts, activeAccountId, loading, error } = useAccountsStore()
  const setActiveAccount = useAccountsStore((s) => s.setActiveAccount)
  
  // 组件逻辑...
}
```

**创建账户**：
```typescript
const { createAccount } = useAccountsStore()

await createAccount({
  name: 'My S3 Account',
  provider: 'aws_s3',
  endpoint: 's3.amazonaws.com',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  useSSL: true,
  port: 443
})
```

**测试连接**：
```typescript
const { testConnection } = useAccountsStore()

const result = await testConnection('account-id-123')
// result: { status: 'ok' | 'error' | 'running', message: string, checkedAt: string }
```

**切换账户**：
```typescript
const { setActiveAccount } = useAccountsStore()

await setActiveAccount('account-id-456')
```

---

## 路由配置快速参考

### TanStack Router 文件系统路由结构

```
frontend/src/routes/
├── __root.tsx                  # 根布局
├── index.tsx                   # 首页 (/)
├── settings.tsx                # 设置页 (/settings)
└── accounts/
    └── $accountId/
        └── dashboard.tsx       # Dashboard (/accounts/$accountId/dashboard)
```

### 路由文件示例

**根路由 (`__root.tsx`)**:
```typescript
import { createRootRoute, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => <Outlet />,
})
```

**首页 (`index.tsx`)**:
```typescript
import { createFileRoute } from '@tanstack/react-router'
import HomePage from '@/pages/HomePage'

export const Route = createFileRoute('/')({
  component: HomePage,
})
```

**Dashboard (`accounts/$accountId/dashboard.tsx`)**:
```typescript
import { createFileRoute } from '@tanstack/react-router'
import DashboardPage from '@/pages/DashboardPage'

export const Route = createFileRoute('/accounts/$accountId/dashboard')({
  component: DashboardPage,
})
```

### 在组件中导航
```typescript
import { useNavigate } from '@tanstack/react-router'

function MyComponent() {
  const navigate = useNavigate()
  
  const goToDashboard = (accountId: string) => {
    navigate({ to: '/accounts/$accountId/dashboard', params: { accountId } })
  }
  
  const goToSettings = () => {
    navigate({ to: '/settings' })
  }
  
  return (
    <>
      <button onClick={() => goToDashboard('123')}>Go to Dashboard</button>
      <button onClick={goToSettings}>Settings</button>
    </>
  )
}
```

### 获取路由参数
```typescript
import { useParams } from '@tanstack/react-router'

function DashboardPage() {
  const { accountId } = useParams({ from: '/accounts/$accountId/dashboard' })
  
  // 使用 accountId...
}
```

### 类型安全的路由
```typescript
// TanStack Router 自动类型检查路由参数
// 以下代码在编译时会报错（参数类型不匹配）
navigate({ to: '/accounts/$accountId/dashboard', params: { wrongKey: '123' } })
```

---

## 组件模板

### 账户卡片组件
```typescript
// frontend/src/components/accounts/AccountCard.tsx
import { Card } from '@/components/ui/card'
import { useNavigate } from '@tanstack/react-router'
import { useAccountsStore } from '@/state/accounts'
import { AccountModel } from '@/state/accounts'

interface AccountCardProps {
  account: AccountModel
}

export function AccountCard({ account }: AccountCardProps) {
  const navigate = useNavigate()
  const connectionTests = useAccountsStore((s) => s.connectionTests)
  const probe = connectionTests[account.id]
  
  const connectionColor = probe
    ? probe.status === 'ok'
      ? 'bg-emerald-100'
      : 'bg-red-100'
    : 'bg-gray-100'
  
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow p-4"
      onClick={() => navigate({ 
        to: '/accounts/$accountId/dashboard', 
        params: { accountId: account.id } 
      })}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">{account.name}</h3>
          <p className="text-sm text-muted-foreground">{account.providerLabel}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${connectionColor}`} />
      </div>
      <p className="text-xs text-muted-foreground truncate">{account.endpoint}</p>
    </Card>
  )
}
```

### 连接测试按钮
```typescript
// frontend/src/components/accounts/ConnectionTestButton.tsx
import { Button } from '@/components/ui/button'
import { ShieldCheck, AlertCircle, CheckCircle } from 'lucide-react'
import { useAccountsStore } from '@/state/accounts'
import { useState } from 'react'

interface ConnectionTestButtonProps {
  accountId: string
  disabled?: boolean
}

export function ConnectionTestButton({ accountId, disabled }: ConnectionTestButtonProps) {
  const [testing, setTesting] = useState(false)
  const { testConnection, connectionTests } = useAccountsStore()
  
  const probe = connectionTests[accountId]
  
  const handleTest = async () => {
    setTesting(true)
    try {
      await testConnection(accountId)
    } finally {
      setTesting(false)
    }
  }
  
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || testing}
        onClick={handleTest}
        className="gap-1"
      >
        <ShieldCheck className="h-4 w-4" />
        {testing ? '测试中...' : '测试连接'}
      </Button>
      
      {probe && (
        <div className="flex items-center gap-1 text-xs">
          {probe.status === 'ok' && (
            <>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-600">连接正常</span>
            </>
          )}
          {probe.status === 'error' && (
            <>
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-red-600">连接异常</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

### AccountSwitcher（Sidebar 中的账户切换器）
```typescript
// frontend/src/components/accounts/AccountSwitcher.tsx
import { useAccountsStore } from '@/state/accounts'
import { cn } from '@/lib/utils'

export function AccountSwitcher() {
  const { accounts, activeAccountId, setActiveAccount } = useAccountsStore()
  
  return (
    <div className="space-y-1 px-2 py-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold px-2">
        我的账户
      </p>
      {accounts.map((account) => (
        <button
          key={account.id}
          onClick={() => setActiveAccount(account.id)}
          className={cn(
            'w-full px-3 py-2 text-left text-sm rounded-md transition-colors',
            activeAccountId === account.id
              ? 'bg-primary text-primary-foreground font-semibold'
              : 'hover:bg-accent text-foreground'
          )}
          title={account.endpoint}
        >
          <div className="truncate">{account.name}</div>
          <div className="text-xs opacity-75">{account.providerLabel}</div>
        </button>
      ))}
    </div>
  )
}
```

---

## 表单验证模式

### 基础表单验证
```typescript
interface CreateAccountInput {
  name: string
  provider: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  region?: string
  useSSL?: boolean
  port?: number
}

function validateForm(data: CreateAccountInput): string[] {
  const errors: string[] = []
  
  if (!data.name?.trim()) errors.push('账户名称不能为空')
  if (!data.provider) errors.push('请选择供应商')
  if (!data.endpoint?.trim()) errors.push('Endpoint 不能为空')
  if (!isValidUrl(data.endpoint)) errors.push('Endpoint 格式不正确')
  if (!data.accessKeyId?.trim()) errors.push('Access Key ID 不能为空')
  if (!data.secretAccessKey?.trim()) errors.push('Secret Access Key 不能为空')
  
  return errors
}

function isValidUrl(url: string): boolean {
  try {
    new URL(`https://${url}`)
    return true
  } catch {
    return false
  }
}
```

---

## TypeScript 类型参考

### 账户相关类型
```typescript
// 账户模型
interface AccountModel {
  id: string
  name: string
  provider: string                      // 'aws_s3', 'aliyun_oss', etc.
  providerLabel: string                 // 'AWS S3', '阿里云 OSS', etc.
  endpoint: string
  accessKeyId?: string                  // 通常不在前端显示
  accessKeyPreview?: string              // 如 "AKIA...****"
  region?: string
  useSSL?: boolean
  port?: number
}

// 创建账户输入
interface CreateAccountInput {
  name: string
  provider: string
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  region?: string
  useSSL?: boolean
  port?: number
}

// 连接测试结果
interface ConnectionProbe {
  status: 'ok' | 'error' | 'running'
  message?: string
  checkedAt?: string
}

// 供应商元数据
interface ProviderMetadata {
  id: string                             // 'aws_s3', 'aliyun_oss', etc.
  name: string                           // 'AWS S3', '阿里云 OSS', etc.
  icon?: string                          // SVG 或 URL
  description?: string
}
```

---

## 常见实现模式

### 模式 1: 异步操作的加载状态管理
```typescript
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

const handleSave = async () => {
  setLoading(true)
  setError(null)
  try {
    await createAccount(formData)
    // 成功后的操作
  } catch (err) {
    setError((err as Error).message)
  } finally {
    setLoading(false)
  }
}
```

### 模式 2: 表单状态受控
```typescript
const [formData, setFormData] = useState<CreateAccountInput>({
  name: '',
  provider: '',
  endpoint: '',
  accessKeyId: '',
  secretAccessKey: '',
})

const handleInputChange = (key: keyof CreateAccountInput, value: string | boolean) => {
  setFormData((prev) => ({ ...prev, [key]: value }))
}

// 在表单元素中
<input
  value={formData.name}
  onChange={(e) => handleInputChange('name', e.target.value)}
/>
```

### 模式 3: 条件渲染
```typescript
if (loading) {
  return <Skeleton />
}

if (error) {
  return <ErrorBanner message={error} />
}

if (accounts.length === 0) {
  return <EmptyState />
}

return <AccountList accounts={accounts} />
```

---

## 调试技巧

### 1. 检查 Store 状态
```typescript
// 在浏览器控制台
accountsStore.getState()  // 查看完整状态
accountsStore.subscribe((state) => console.log(state))  // 监听状态变化
```

### 2. 检查 ConnectionProbe 缓存
```typescript
const { connectionTests } = useAccountsStore()
console.log(connectionTests)  // 显示所有账户的连接状态
```

### 3. 路由调试
```typescript
// 使用 React Router DevTools
// 或在浏览器中查看 URL 变化
```

### 4. 性能调试
```typescript
// 使用 React DevTools Profiler
// 找出不必要的重渲染
```

---

## 常见错误与解决方案

| 错误 | 原因 | 解决方案 |
|------|------|--------|
| "Cannot read property 'id' of undefined" | activeAccount 为 null | 检查 bootstrap() 是否成功执行 |
| 路由不生效 | RouterProvider 未正确配置 | 检查 App.tsx 和 routing.ts 配置 |
| 表单提交后页面不刷新 | 未调用 Store 更新方法 | 确保在异步操作后 setActiveAccount() 被调用 |
| 连接测试无响应 | 后端 API 超时 | 添加 3s 超时提示，允许用户重试 |
| Sidebar 账户列表不更新 | Store 订阅未绑定 | 使用 useAccountsStore() 正确订阅 |

---

## 依赖版本要求

```json
{
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "@tanstack/react-router": "^1.0.0",
  "@tanstack/react-router-devtools": "^1.0.0",
  "zustand": "^4.0.0",
  "lucide-react": "^latest",
  "clsx": "^1.0.0"
}
```

---

## 文件清单（新增/修改）

### 新增文件（路由）
- [ ] `frontend/src/routes/__root.tsx` (根路由)
- [ ] `frontend/src/routes/index.tsx` (首页)
- [ ] `frontend/src/routes/settings.tsx` (设置页)
- [ ] `frontend/src/routes/accounts/$accountId/dashboard.tsx` (Dashboard)
- [ ] `frontend/src/routeTree.gen.ts` (自动生成的路由树，勿手动编辑)

### 新增文件（页面和组件）
- [ ] `frontend/src/pages/HomePage.tsx`
- [ ] `frontend/src/pages/DashboardPage.tsx`
- [ ] `frontend/src/pages/SettingsPage.tsx`
- [ ] `frontend/src/components/layouts/HomeLayout.tsx`
- [ ] `frontend/src/components/layouts/DashboardLayout.tsx`
- [ ] `frontend/src/components/layouts/Sidebar.tsx`
- [ ] `frontend/src/components/accounts/AccountSelector.tsx`
- [ ] `frontend/src/components/accounts/AccountCard.tsx`
- [ ] `frontend/src/components/accounts/AccountCardGrid.tsx`
- [ ] `frontend/src/components/accounts/AccountSwitcher.tsx`
- [ ] `frontend/src/components/accounts/ConnectionTestButton.tsx`
- [ ] `frontend/src/components/accounts/ProviderSelector.tsx`
- [ ] `frontend/src/components/settings/SettingsPage.tsx`

### 修改文件
- [ ] `frontend/src/main.tsx` (集成 TanStack Router)
- [ ] `frontend/src/state/accounts.ts` (优化 Store)
- [ ] `frontend/src/components/accounts/AccountFormDrawer.tsx` (添加测试连接)
- [ ] `frontend/package.json` (添加 tsr 代码生成脚本)

### 备份或删除
- [ ] 保留旧 App.tsx 备份（可选删除）

---

## 快速启动命令

```bash
# 安装依赖
pnpm install --frozen-lockfile --dir frontend

# 生成路由树（每次添加新路由文件后运行）
pnpm --dir frontend run tsr

# 开发模式（完整应用）
wails dev

# 仅前端开发
pnpm --dir frontend dev

# 构建
pnpm --dir frontend build && wails build

# 运行测试
pnpm --dir frontend test

# 格式化代码
pnpm --dir frontend lint
```

### package.json 脚本配置

在 `frontend/package.json` 中添加以下脚本：

```json
{
  "scripts": {
    "tsr": "tsr generate",
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint src --ext ts,tsx",
    "test": "vitest"
  }
}
```

---

## 最后查阅资源

- **详细设计文档**: [FRONTEND_REDESIGN_PLAN.md](./FRONTEND_REDESIGN_PLAN.md)
- **实现清单**: [IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)
- **账户管理规范**: [account_management_multi_account.md](./spec/account_management_multi_account.md)
- **项目指南**: [../AGENTS.md](../AGENTS.md)
- **TanStack Router 官方文档**: https://tanstack.com/router/latest
- **Zustand 官方文档**: https://github.com/pmndrs/zustand

---

**最后更新**: 2025-12-04  
**版本**: v2.0  
**变更**: 切换至 TanStack Router，简化流程文档
