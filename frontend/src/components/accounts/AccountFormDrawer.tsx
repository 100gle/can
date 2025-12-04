import { Loader2, Plus, Save, Trash2, X } from "lucide-react"
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { AccountFormInput, accountsStore, type AccountModel, type ProviderMetadata } from "@/state/accounts"

export type AccountFormDrawerProps = {
  open: boolean
  mode: "create" | "edit"
  providers: ProviderMetadata[]
  initialAccount?: AccountModel
  onClose: () => void
}

const createDefaultForm = (providerId?: string): AccountFormInput => ({
  name: "",
  provider: providerId ?? "aws",
  endpoint: "",
  region: "",
  accessKeyId: "",
  secretAccessKey: "",
  useSSL: true,
  port: 443,
})

export const AccountFormDrawer = ({ open, mode, providers, initialAccount, onClose }: AccountFormDrawerProps) => {
  const fallbackProvider = providers[0]?.id ?? "aws"
  const [form, setForm] = useState<AccountFormInput>(() => createDefaultForm(fallbackProvider))
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string>()

  useEffect(() => {
    if (!open) return
    if (mode === "edit" && initialAccount) {
      setForm({
        name: initialAccount.name,
        provider: initialAccount.provider,
        endpoint: initialAccount.endpoint,
        region: initialAccount.region,
        accessKeyId: "",
        secretAccessKey: "",
        useSSL: initialAccount.useSSL,
        port: initialAccount.port,
      })
    } else {
      setForm(createDefaultForm(fallbackProvider))
    }
    setLocalError(undefined)
  }, [open, mode, initialAccount, fallbackProvider])

  const title = mode === "create" ? "连接 S3 兼容存储" : "编辑账户"
  const submitLabel = mode === "create" ? "创建账户" : "保存修改"
  const submitIcon = mode === "create" ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />

  const handleChange = <K extends keyof AccountFormInput>(field: K, value: AccountFormInput[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const requiredFields: Array<keyof AccountFormInput> = mode === "create"
    ? ["name", "endpoint", "accessKeyId", "secretAccessKey"]
    : ["name", "endpoint"]

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const missing = requiredFields.find((field) => !String(form[field] ?? "").trim())
    if (missing) {
      setLocalError("请填写所有必填项")
      return
    }
    setLocalError(undefined)
    setSubmitting(true)
    try {
      if (mode === "create") {
        await accountsStore.createAccount(form)
      } else if (initialAccount) {
        await accountsStore.updateAccount(initialAccount.id, form)
      }
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败"
      setLocalError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!initialAccount) return
    const confirmed = window.confirm(`确定要删除账户 “${initialAccount.name}” 吗？此操作不可撤销。`)
    if (!confirmed) return
    setSubmitting(true)
    try {
      await accountsStore.deleteAccount(initialAccount.id)
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败"
      setLocalError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const providerOptions = useMemo(() => {
    if (providers.length) return providers
    return [
      { id: "aws", label: "AWS S3", description: "" },
      { id: "oss", label: "Aliyun OSS", description: "" },
      { id: "cos", label: "Tencent COS", description: "" },
      { id: "r2", label: "Cloudflare R2", description: "" },
    ]
  }, [providers])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-background/95 p-6 shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{mode === "create" ? "新建账户" : "账户设置"}</p>
            <h3 className="text-2xl font-semibold">{title}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭弹窗">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-6 overflow-y-auto">
          <div className="grid gap-4">
            <label className="text-sm font-medium">
              账户名称<span className="text-destructive">*</span>
              <input
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                placeholder="如：AWS 主账户"
                value={form.name}
                onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange("name", event.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium">
              服务商<span className="text-destructive">*</span>
              <select
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                value={form.provider}
                onChange={(event) => handleChange("provider", event.target.value)}
              >
                {providerOptions.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium lg:col-span-2">
              Endpoint<span className="text-destructive">*</span>
              <input
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                placeholder="https://s3.amazonaws.com"
                value={form.endpoint}
                onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange("endpoint", event.target.value)}
                required
              />
            </label>
            <label className="text-sm font-medium">
              默认区域
              <input
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                placeholder="us-east-1 / cn-hangzhou"
                value={form.region}
                onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange("region", event.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              端口
              <input
                type="number"
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                value={form.port}
                min={1}
                max={65535}
                onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange("port", Number(event.target.value) || 0)}
              />
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-medium">
              Access Key ID{mode === "create" ? <span className="text-destructive">*</span> : null}
              <input
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                placeholder="AKIA...."
                value={form.accessKeyId ?? ""}
                onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange("accessKeyId", event.target.value)}
                required={mode === "create"}
              />
            </label>
            <label className="text-sm font-medium">
              Secret Access Key{mode === "create" ? <span className="text-destructive">*</span> : null}
              <input
                className="mt-2 w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-sm"
                placeholder={mode === "create" ? "仅本机加密存储" : "留空则保持不变"}
                type="password"
                value={form.secretAccessKey ?? ""}
                onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange("secretAccessKey", event.target.value)}
                required={mode === "create"}
              />
            </label>
          </div>

          <label className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-primary"
              checked={form.useSSL}
              onChange={(event: ChangeEvent<HTMLInputElement>) => handleChange("useSSL", event.target.checked)}
            />
            启用 SSL/TLS 访问
          </label>

          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}

          <div className="flex flex-col gap-4 border-t border-border/40 pt-4">
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                取消
              </Button>
              <Button type="submit" className="gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitIcon}
                {submitLabel}
              </Button>
            </div>
            {mode === "edit" && initialAccount ? (
              <div className="rounded-2xl border border-destructive/50 bg-destructive/5 p-4">
                <p className="text-sm font-semibold text-destructive">危险操作</p>
                <p className="mt-1 text-xs text-muted-foreground">删除账户将移除所有本地配置，操作不可恢复。</p>
                <Button
                  type="button"
                  variant="destructive"
                  className="mt-3 gap-2"
                  onClick={handleDelete}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  删除账户
                </Button>
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
