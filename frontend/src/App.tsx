import {
  Cloud,
  Database,
  Loader2,
  LucideIcon,
  Moon,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  Wifi,
} from "lucide-react"
import {
  forwardRef,
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from "react"
import { cva, type VariantProps } from "class-variance-authority"
import logo from "./assets/images/logo-universal.png"
import { cn } from "@/lib/utils"
import { accountsStore, useAccountsStore, type AccountModel, type ConnectionProbe } from "@/state/accounts"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
))
Button.displayName = "Button"

const badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", {
  variants: {
    variant: {
      default: "border-transparent bg-secondary/70 text-secondary-foreground",
      outline: "border-border/70 text-foreground",
      success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
)

const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "rounded-3xl border border-border/70 bg-card/80 p-6 text-card-foreground shadow-lg shadow-border/20",
      className
    )}
    {...props}
  />
)

type Stat = {
  icon: LucideIcon
  label: string
  value: string
  hint: string
}

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

  const activeAccount = useMemo(() => {
    if (!accounts.length) return undefined
    return accounts.find((item) => item.id === activeAccountId) ?? accounts[0]
  }, [accounts, activeAccountId])

  useEffect(() => {
    accountsStore.bootstrap()
  }, [])

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
      <aside className="hidden w-[320px] flex-col border-r border-border/40 bg-sidebar/40 p-6 backdrop-blur-xl xl:flex">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="logo" className="h-10 w-10 rounded-2xl bg-secondary/40 p-1.5" />
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Nebula</p>
              <h1 className="text-xl font-semibold">Object Studio</h1>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="切换主题">
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>

        <div className="mt-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">支持的服务商</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {providers.map((provider) => (
              <Badge key={provider.id} variant="outline">
                {provider.label}
              </Badge>
            ))}
            {!providers.length ? <Badge variant="outline">加载中...</Badge> : null}
          </div>
        </div>

        <div className="mt-8 flex-1 overflow-hidden">
          <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
            <span>账户</span>
            <span>{accounts.length}</span>
          </div>
          <div className="mt-3 space-y-3 overflow-y-auto pr-2">
            {accounts.map((account) => (
              <SidebarAccountItem
                key={account.id}
                account={account}
                active={activeAccount?.id === account.id}
                onSelect={handleSelectAccount}
                loading={loading}
              />
            ))}
            {!accounts.length ? (
              <Card className="border-dashed text-sm text-muted-foreground">
                <p>尚未配置账户。</p>
                <p className="mt-1">通过“新建账户”按钮即可接入 AWS / OSS / COS / R2。</p>
              </Card>
            ) : null}
          </div>
        </div>
      </aside>

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
              <Button variant="default" className="gap-2" disabled>
                <Plus className="h-4 w-4" />
                新建账户 · 开发中
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

const SidebarAccountItem = ({
  account,
  active,
  onSelect,
  loading,
}: {
  account: AccountModel
  active: boolean
  loading: boolean
  onSelect: (account: AccountModel) => void
}) => (
  <button
    type="button"
    onClick={() => onSelect(account)}
    disabled={loading}
    className={cn(
      "w-full rounded-2xl border border-transparent bg-card/60 p-4 text-left transition hover:border-border/80",
      active && "border-primary/60 bg-primary/10"
    )}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="font-medium">{account.name}</p>
        <p className="text-xs text-muted-foreground">
          {account.providerLabel} · {account.region || "Region 未设置"}
        </p>
      </div>
      {active ? <Badge variant="success">Active</Badge> : null}
    </div>
    <p className="mt-3 text-xs text-muted-foreground">Endpoint · {account.endpoint}</p>
  </button>
)

export default App
