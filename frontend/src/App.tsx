import { Cloud, Database, Loader2, Plus, RefreshCcw, ShieldCheck, Sparkles, Wifi } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { AccountSidebar } from "@/components/accounts/AccountSidebar"
import { AccountFormDrawer } from "@/components/accounts/AccountFormDrawer"
import { accountsStore, useAccountsStore, type AccountModel, type ConnectionProbe } from "@/state/accounts"

const futureModules = [
  { title: "Bucket 属性与策略", detail: "Versioning · CORS · Policy" },
  { title: "对象批量操作", detail: "复制 / 移动 / 标签" },
  { title: "传输调度", detail: "分片上传 · 队列管理" },
]

const placeholderBuckets = [
  { name: "product-assets", region: "us-east-1", objects: "1.2M", size: "4.7 TB" },
  { name: "media-staging", region: "ap-southeast-1", objects: "320K", size: "1.3 TB" },
  { name: "logs-r2", region: "global", objects: "87K", size: "420 GB" },
]

function App() {
  const { accounts, providers, loading, error, activeAccountId, connectionProbe } = useAccountsStore((state) => state)
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false
    return document.documentElement.classList.contains("dark")
  })
  const [drawerState, setDrawerState] = useState<{ open: boolean; mode: "create" | "edit"; account?: AccountModel }>({
    open: false,
    mode: "create",
  })

  const activeAccount = useMemo(() => {
    if (!accounts.length) return undefined
    return accounts.find((item) => item.id === activeAccountId) ?? accounts[0]
  }, [accounts, activeAccountId])

  useEffect(() => {
    accountsStore.bootstrap()
  }, [])

  const openDrawer = (mode: "create" | "edit", account?: AccountModel) => {
    setDrawerState({ open: true, mode, account })
  }

  const closeDrawer = () => setDrawerState((prev) => ({ ...prev, open: false }))

  const toggleTheme = () => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    root.classList.toggle("dark")
    setIsDark(root.classList.contains("dark"))
  }

  const handleSelectAccount = (account: AccountModel) => {
    void accountsStore.setActiveAccount(account.id)
  }

  const handleRefresh = () => {
    void accountsStore.refresh()
  }

  const handleTestConnection = () => {
    if (!activeAccount) return
    void accountsStore.testConnection(activeAccount.id)
  }

  const connectionPreview = getConnectionPreview(connectionProbe)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AccountSidebar
        accounts={accounts}
        providers={providers}
        activeAccountId={activeAccountId}
        loading={loading}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onSelectAccount={handleSelectAccount}
      />

      <main className="flex-1">
        <header className="border-b border-border/40 bg-gradient-to-br from-background via-background/80 to-background/40 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">当前会话账户</p>
              <h2 className="mt-1 text-3xl font-semibold">
                {activeAccount ? activeAccount.name : "尚未选择账户"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {activeAccount
                  ? `${activeAccount.providerLabel} · ${activeAccount.region || "Region 未设置"}`
                  : "选择或新建一个账户以开始同步 Buckets"}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2" onClick={handleRefresh} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                刷新
              </Button>
              <Button variant="secondary" className="gap-2" onClick={handleTestConnection} disabled={!activeAccount}>
                <ShieldCheck className="h-4 w-4" />
                测试连接
              </Button>
              <Button variant="outline" className="gap-2" disabled={!activeAccount} onClick={() => activeAccount && openDrawer("edit", activeAccount)}>
                编辑账户
              </Button>
              <Button variant="default" className="gap-2" onClick={() => openDrawer("create")}>
                <Plus className="h-4 w-4" />
                新建账户
              </Button>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </header>

        <section className="grid gap-6 p-6 lg:grid-cols-2 xl:grid-cols-3">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">凭证摘要</p>
                <h3 className="mt-2 text-xl font-semibold">{activeAccount?.accessKeyPreview || "-"}</h3>
              </div>
              <Cloud className="h-10 w-10 text-primary" />
            </div>
            <dl className="mt-6 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <dt>Endpoint</dt>
                <dd className="text-foreground">{activeAccount?.endpoint || "-"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>SSL</dt>
                <dd>{activeAccount?.useSSL ? "已开启" : "未启用"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>端口</dt>
                <dd>{activeAccount?.port || 443}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">连接状态</p>
                <h3 className={cn("mt-2 text-xl font-semibold", connectionPreview.color)}>{connectionPreview.title}</h3>
              </div>
              <Wifi className={cn("h-10 w-10", connectionPreview.iconColor)} />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{connectionPreview.message}</p>
            {connectionPreview.timestamp ? (
              <p className="mt-2 text-xs text-muted-foreground">最近检测 · {connectionPreview.timestamp}</p>
            ) : null}
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">路线图</p>
                <h3 className="mt-2 text-xl font-semibold">下一阶段</h3>
              </div>
              <Sparkles className="h-10 w-10 text-accent" />
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              {futureModules.map((item) => (
                <li key={item.title} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground">{item.detail}</p>
                  </div>
                  <Badge variant="success">规划中</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>

        <section className="flex flex-col gap-4 p-6 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">多云 Bucket 列表</p>
              <h3 className="text-lg font-semibold">跨服务商概览 · 即将接入 API</h3>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold">最近关注</h4>
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 divide-y divide-border/40 text-sm">
                {placeholderBuckets.map((bucket) => (
                  <div key={bucket.name} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{bucket.name}</p>
                      <p className="text-muted-foreground">{bucket.region}</p>
                    </div>
                    <div className="text-right text-muted-foreground">
                      <p>{bucket.objects} 对象</p>
                      <p>{bucket.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <h4 className="text-base font-semibold">阶段进度</h4>
                <ShieldCheck className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div className="mt-4 space-y-4">
                {progressRoadmap.map((item) => (
                  <div key={item.title}>
                    <div className="flex items-center justify-between text-sm">
                      <p className="font-medium">{item.title}</p>
                      <span className="text-muted-foreground">{item.status}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-border/60">
                      <div className={cn("h-full rounded-full bg-primary", item.progressClass)} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      </main>
      <AccountFormDrawer
        open={drawerState.open}
        mode={drawerState.mode}
        providers={providers}
        initialAccount={drawerState.account}
        onClose={closeDrawer}
      />
    </div>
  )
}

const progressRoadmap = [
  { title: "账户模块架构", status: "已完成", detail: "服务层 + 加密 + Stub Dialer", progressClass: "w-full" },
  { title: "Bucket 列表", status: "进行中", detail: "等待 API 适配", progressClass: "w-1/2" },
  { title: "传输模块", status: "计划中", detail: "分片上传、并发控制", progressClass: "w-1/4" },
]

const getConnectionPreview = (probe: ConnectionProbe) => {
  const status = probe.status
  if (status === "running") {
    return {
      title: "检测中",
      message: "调用云端 API 以验证访问凭证...",
      timestamp: undefined,
      color: "text-foreground",
      iconColor: "text-primary",
    }
  }
  if (status === "ok") {
    return {
      title: "连接正常",
      message: probe.message || "凭证已通过校验，可进行 Bucket 操作",
      timestamp: probe.checkedAt,
      color: "text-emerald-400",
      iconColor: "text-emerald-400",
    }
  }
  if (status === "error") {
    return {
      title: "连接异常",
      message: probe.message || "无法建立连接，请检查 Endpoint / 凭证",
      timestamp: probe.checkedAt,
      color: "text-destructive",
      iconColor: "text-destructive",
    }
  }
  return {
    title: "等待检测",
    message: "点击“测试连接”即可触发 API 探测",
    timestamp: undefined,
    color: "text-muted-foreground",
    iconColor: "text-muted-foreground",
  }
}

export default App
