import {
  forwardRef,
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type FormEvent,
  type HTMLAttributes,
} from "react"
import { cva, type VariantProps } from "class-variance-authority"
import {
  Cloud,
  Database,
  Moon,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  UploadCloud,
  type LucideIcon,
} from "lucide-react"
import logo from "./assets/images/logo-universal.png"
import { cn } from "@/lib/utils"
import { Greet } from "../wailsjs/go/main/App"

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

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
)
Button.displayName = "Button"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary/70 text-secondary-foreground",
        outline: "border-border/70 text-foreground",
        success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

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

type Highlight = {
  title: string
  description: string
  icon: LucideIcon
}

type PipelineStep = {
  title: string
  detail: string
  status: "done" | "ready" | "pending"
}

const highlights: Highlight[] = [
  {
    title: "多云账户聚合",
    description: "AWS · OSS · COS · R2 一站式接入",
    icon: Cloud,
  },
  {
    title: "端到端加密",
    description: "本地密钥加密存储凭证",
    icon: ShieldCheck,
  },
  {
    title: "极速对象操作",
    description: "拖拽上传、批量任务、断点续传",
    icon: UploadCloud,
  },
  {
    title: "实时同步",
    description: "多标签监听、秒级刷新",
    icon: RefreshCcw,
  },
]

const pipelineSteps: PipelineStep[] = [
  {
    title: "导入凭证",
    detail: "本地加密 + Endpoint 校验",
    status: "done",
  },
  {
    title: "访问策略体检",
    detail: "检测读写/对象锁权限",
    status: "ready",
  },
  {
    title: "元数据缓存",
    detail: "Bucket + 对象索引预热",
    status: "pending",
  },
]

const quickStats = [
  { label: "连接延迟", value: "127 ms", hint: "杭州 · 内网" },
  { label: "Bucket 数量", value: "42", hint: "最近同步" },
  { label: "传输任务", value: "8", hint: "上传 3 · 下载 5" },
  { label: "实时告警", value: "0", hint: "全部正常" },
]

const techBadges = [
  { label: "Tailwind CSS 4.1", variant: "success" as const },
  { label: "shadcn/ui 原子组件", variant: "success" as const },
  { label: "tw-animate", variant: "default" as const },
  { label: "Lucide React", variant: "default" as const },
]

function App() {
  const [resultText, setResultText] = useState("调用 Go · Wails Greet 以确认桥接状态")
  const [name, setName] = useState("")
  const [isInvoking, setIsInvoking] = useState(false)
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === "undefined") return false
    return document.documentElement.classList.contains("dark")
  })

  useEffect(() => {
    if (typeof document === "undefined") return
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  const updateName = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
  }

  const toggleTheme = () => {
    if (typeof document === "undefined") return
    const root = document.documentElement
    root.classList.toggle("dark")
    setIsDark(root.classList.contains("dark"))
  }

  const handleGreet = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = name.trim()
    if (!payload) {
      setResultText("请先输入要发送给 Go 后端的昵称 👀")
      return
    }

    setIsInvoking(true)
    try {
      const response = await Greet(payload)
      setResultText(response)
    } catch (error) {
      console.error("Failed to invoke Greet", error)
      setResultText("调用失败，请检查 Wails 后端是否已运行")
    } finally {
      setIsInvoking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-4 py-6 text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <Card className="animate-in fade-in slide-in-from-top-4 space-y-8 bg-card/70 backdrop-blur">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-border/70 bg-background/70 p-3 shadow-inner">
                  <img src={logo} alt="logo" className="h-12 w-12 object-contain" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Wails · Tailwind</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-tight">对象存储控制中心</h1>
                  <p className="text-sm text-muted-foreground">
                    Go + Wails + React · Tailwind CSS 4 · shadcn/ui 原子组件
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline">前端预览</Badge>
              <Badge variant="default">Live Tailwind</Badge>
              <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="切换主题">
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickStats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm"
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
                <p className="text-sm text-muted-foreground">{item.hint}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.4fr,0.9fr]">
          <div className="flex flex-col gap-6">
            <Card className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Wails RPC 互通测试</p>
                  <h2 className="text-2xl font-semibold tracking-tight">调用 Go 后端 Greet</h2>
                </div>
                <Badge variant="success" className="gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  实时响应
                </Badge>
              </div>
              <form className="space-y-4" onSubmit={handleGreet}>
                <label className="text-sm font-medium text-muted-foreground" htmlFor="greet-name">
                  输入一个昵称，立即调用后端函数：
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    id="greet-name"
                    value={name}
                    onChange={updateName}
                    autoComplete="off"
                    placeholder="例如：Tailwind Explorer"
                    className="flex-1 rounded-2xl border border-input bg-background px-4 py-3 text-sm shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button type="submit" size="lg" disabled={isInvoking}>
                    {isInvoking ? "调用中..." : "发送到 Go"}
                  </Button>
                </div>
              </form>
              <div className="rounded-2xl border border-border/60 bg-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  返回结果
                </p>
                <p className="mt-2 text-base font-medium text-foreground">{resultText}</p>
              </div>
            </Card>

            <Card className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">核心能力示例</p>
                <h2 className="text-2xl font-semibold tracking-tight">Tailwind + shadcn 组件状态</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {highlights.map((item) => (
                  <div
                    key={item.title}
                    className="group rounded-2xl border border-border/60 bg-background/60 p-4 shadow-sm transition hover:-translate-y-1 hover:bg-primary/10"
                  >
                    <div className="mb-3 inline-flex rounded-2xl border border-border/70 bg-card/60 p-2 text-primary shadow">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">上线前检查</p>
                  <h2 className="text-xl font-semibold tracking-tight">Pipeline 预览</h2>
                </div>
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-4">
                {pipelineSteps.map((step) => (
                  <div key={step.title} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-1 h-2.5 w-2.5 rounded-full",
                        step.status === "done" && "bg-emerald-500",
                        step.status === "ready" && "bg-amber-400",
                        step.status === "pending" && "bg-border"
                      )}
                    />
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">配置状态</p>
                <h2 className="text-xl font-semibold tracking-tight">Tailwind & shadcn 运行中</h2>
              </div>
              <div className="flex flex-wrap gap-3">
                {techBadges.map((badge) => (
                  <Badge key={badge.label} variant={badge.variant}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground">
                观察背景、文字、边框和按钮的配色、阴影与动画，若样式与 shadcn 设计语言一致，说明 Tailwind CSS + shadcn/ui 已正确加载。
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tailwind 变量</span>
                  <span className="font-medium text-foreground">bg-background / text-foreground</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">shadcn Button</span>
                  <span className="font-medium text-foreground">{isInvoking ? "Loading" : "Ready"}</span>
                </div>
              </div>
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">工作负载示例</p>
                  <h2 className="text-xl font-semibold tracking-tight">对象存储概要</h2>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                这里可以扩展为真实的 Bucket 列表或传输队列。Tailwind 工具类已经准备好随时搭建更复杂的可视化界面。
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
