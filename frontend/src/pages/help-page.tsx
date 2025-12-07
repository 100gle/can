import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import quickStartDoc from "@/assets/docs/help/getting-started.md?raw";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowRight,
  BookOpenCheck,
  ExternalLink,
  Github,
  LifeBuoy,
  Mail,
  MessageCircle,
  PlayCircle,
  Shield,
} from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

type QuickStartStep = {
  title: string;
  description: string;
  tip: string;
};

const QUICK_START_STEPS: QuickStartStep[] = [
  {
    title: "1. 连接账户 · Connect Accounts",
    description:
      "进入“多账户连接中心 / Accounts Hub”，填写 Endpoint、AK/SK、Region，保存前先执行“测试连接 / Test Connection”。",
    tip: "Home → 新建账户 / New Account",
  },
  {
    title: "2. 浏览存储桶 · Explore Buckets",
    description:
      "从仪表盘或左侧列表中选择 Bucket，利用搜索、筛选、右键菜单进行管理，实时查看区域、版本控制等信息。",
    tip: "Dashboard → Buckets",
  },
  {
    title: "3. 上传与下载 · Upload & Download",
    description:
      "拖拽文件/文件夹至对象浏览器或使用工具栏按钮，任务自动加入传输队列，暂停/恢复、限速与断点续传默认开启。",
    tip: "对象浏览器 Object Explorer",
  },
  {
    title: "4. 配置安全策略 · Harden Security",
    description:
      "访问“安全中心 / Security Center”审查 ACL、公共访问、MFA Delete，同时在系统设置中导出备份、开启空闲锁定。",
    tip: "Accounts → 安全中心 / Security",
  },
];

const FAQS = [
  {
    question: "上传速度很慢怎么办？ · Slow uploads?",
    answer:
      "检查当前账户的区域与本地网络之间的距离，必要时开启加速域名或使用就近 Region；同时可在传输设置中提高并发数或关闭限速。/ Ensure the bucket region is close to your workstation, enable acceleration when available, and adjust concurrency or disable throttling under Transfer Settings.",
  },
  {
    question: "如何提交调试信息？ · How to share diagnostics?",
    answer:
      "系统设置 → 数据导出中可生成加密日志包；或在反馈表单中勾选“附带系统信息”，CAN 会自动附上版本、系统、活跃任务等概要。/ Use Settings → Backup to export encrypted logs, or enable “include diagnostics” inside the feedback form so the email contains version and platform metadata.",
  },
  {
    question: "窗口关闭后任务会继续吗？ · Do transfers continue when hidden?",
    answer:
      "是的，Cmd/Ctrl+W 仅会隐藏窗口，传输服务仍会运行；通过托盘图标或 Dock 重新显示即可。/ Yes. Cmd/Ctrl+W hides the window but keeps background workers online. Re-open the window from the tray or Dock.",
  },
];

const SHORTCUTS = [
  {
    combo: "⌘ / Ctrl + K",
    label: "命令面板 · Command Palette",
    description: "快速跳转到任意桶、页面或最近操作 / Jump anywhere instantly.",
  },
  {
    combo: "⌘ / Ctrl + F",
    label: "搜索当前目录 · Focus Search",
    description: "聚焦文件过滤器 / Focus object search bar.",
  },
  {
    combo: "⌘ / Ctrl + E",
    label: "生成预签名链接 · Share via Presigned URL",
    description: "快速调用分享面板 / Open the share modal.",
  },
  {
    combo: "Shift + Space",
    label: "预览对象 · Quick Preview",
    description: "打开内嵌预览器 / Open inline preview.",
  },
  {
    combo: "⌘ / Ctrl + L",
    label: "切换主题 · Toggle Theme",
    description: "在浅色与深色之间切换 / Toggle light or dark theme.",
  },
];

const FEEDBACK_TYPES = [
  { value: "bug", label: "Bug / 问题" },
  { value: "idea", label: "Feature Idea / 功能建议" },
  { value: "ux", label: "UX / 体验" },
];

const SUPPORT_EMAIL = "support@can.app";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";
const DOCS_URL = "https://github.com/100gle/can/blob/main/docs/features.md";
const SHORTCUTS_DOC_URL = "https://github.com/100gle/can/wiki/keyboard";

export default function HelpPage() {
  const markdown = useMemo(() => quickStartDoc, []);
  const [feedbackType, setFeedbackType] = useState<string>("bug");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);

  const handleFeedbackSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const label = FEEDBACK_TYPES.find((item) => item.value === feedbackType)?.label ?? "Feedback";
    const metaLines = [
      includeDiagnostics ? "Diagnostics: enabled" : null,
      contact ? `Contact: ${contact}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    const body = `${details || "Please describe the issue here."}\n\n${metaLines}`;
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[CAN][${label}] ${subject || "Feedback"}`,
    )}&body=${encodeURIComponent(body)}`;
    window.open(mailto, "_blank", "noreferrer");
  };

  return (
    <div className="space-y-8 p-6">
      <PageHeader
        title="帮助与支持 · Help & Support"
        description="快速入门、常见问题、快捷键与反馈通道一站式可见。Find answers fast and stay in flow."
        showBack
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(DOCS_URL, "_blank")}>
              <BookOpenCheck className="mr-2 h-4 w-4" />
              文档 / Docs
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(ISSUES_URL, "_blank")}>
              <Github className="mr-2 h-4 w-4" />
              GitHub Issues
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>快速入门 / Quick Start</CardTitle>
              <CardDescription>核心流程一览，帮助你从 0 到 1。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              {QUICK_START_STEPS.map((step) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-border/40 bg-card/60 p-4 shadow-sm"
                >
                  <p className="font-semibold">{step.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
                  <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {step.tip}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-1">
              <CardTitle>内置指南 / Built-in Guide</CardTitle>
              <CardDescription>文档无需联网即可浏览，Markdown 内容会随版本更新。</CardDescription>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>常见问题 / FAQs</CardTitle>
              <CardDescription>最常见的三类提问，随时复习。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {FAQS.map((faq) => (
                <div key={faq.question} className="rounded-lg border border-border/30 p-4">
                  <p className="font-semibold">{faq.question}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                </div>
              ))}
              <Button
                variant="ghost"
                className="gap-2 px-0 text-primary"
                onClick={() => window.open(DOCS_URL + "#十帮助与支持", "_blank")}
              >
                查看完整 FAQ / View full FAQ
                <ExternalLink className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>快捷键 / Shortcuts</CardTitle>
              <CardDescription>熟练掌握可大幅提升效率。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.combo}
                  className="flex items-center justify-between rounded-lg border border-border/30 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{shortcut.label}</p>
                    <p className="text-xs text-muted-foreground">{shortcut.description}</p>
                  </div>
                  <kbd className="rounded border border-border bg-muted px-2 py-1 text-xs font-mono">
                    {shortcut.combo}
                  </kbd>
                </div>
              ))}
              <Button
                variant="link"
                className="px-0 text-primary"
                onClick={() => window.open(SHORTCUTS_DOC_URL, "_blank")}
              >
                查看完整快捷键 / Full cheat-sheet
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>反馈中心 / Feedback</CardTitle>
              <CardDescription>表单默认会通过邮件发送，可选 GitHub Issues。</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleFeedbackSubmit}>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">反馈类型 / Type</label>
                  <Select value={feedbackType} onValueChange={setFeedbackType}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择类型" />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_TYPES.map((item) => (
                        <SelectItem value={item.value} key={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    标题 / Subject (optional)
                  </label>
                  <Input
                    placeholder="例如：COS 多 AZ 选项保存失败 / COS MAZ toggle issues"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    描述 / Details (必填)
                  </label>
                  <Textarea
                    required
                    rows={4}
                    placeholder="复现步骤、期望行为、附加说明…"
                    value={details}
                    onChange={(event) => setDetails(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    联系方式 / Contact (optional)
                  </label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeDiagnostics}
                    onChange={(event) => setIncludeDiagnostics(event.target.checked)}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  附带系统信息 / Include diagnostics
                </label>
                <div className="flex flex-col gap-3">
                  <Button type="submit" className="gap-2">
                    <Mail className="h-4 w-4" />
                    发送邮件 / Send Email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={() => window.open(ISSUES_URL, "_blank")}
                  >
                    <Github className="h-4 w-4" />
                    改用 GitHub Issues
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>其它资源 / Additional Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
                <LifeBuoy className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">实时状态 / Status Page</p>
                  <p className="text-xs text-muted-foreground">
                    了解 API、上传服务是否正常。Check API availability.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open("https://status.aws.amazon.com", "_blank")}
                >
                  打开
                </Button>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
                <PlayCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">视频教程 / Video Guides</p>
                  <p className="text-xs text-muted-foreground">
                    跳转至官方教程播放列表。Watch quick how-tos.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    window.open("https://www.youtube.com/playlist?list=PLcan", "_blank")
                  }
                >
                  打开
                </Button>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
                <Shield className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">安全白皮书 / Security Notes</p>
                  <p className="text-xs text-muted-foreground">
                    阅读关于加密、密钥托管、MFA Delete 的最佳实践。
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open("https://github.com/100gle/can/wiki/security", "_blank")}
                >
                  打开
                </Button>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
                <MessageCircle className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-semibold">社区讨论 / Community</p>
                  <p className="text-xs text-muted-foreground">
                    加入 Discord / 飞书群讨论使用心得。
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">Discord</Badge>
                  <Badge variant="outline">飞书</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
