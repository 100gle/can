import { AlertCircle, Loader2, Plus, RefreshCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  AccountFormInput,
  accountsStore,
  type AccountModel,
  type ProviderMetadata,
} from "@/state/accounts";

export type AccountFormDrawerProps = {
  open: boolean;
  mode: "create" | "edit";
  providers: ProviderMetadata[];
  initialAccount?: AccountModel;
  onClose: () => void;
};

const createDefaultForm = (providerId?: string): AccountFormInput => ({
  name: "",
  provider: providerId ?? "aws",
  endpoint: "",
  region: "",
  accessKeyId: "",
  secretAccessKey: "",
  useSSL: true,
  port: 443,
});

export const AccountFormDrawer = ({
  open,
  mode,
  providers,
  initialAccount,
  onClose,
}: AccountFormDrawerProps) => {
  const fallbackProvider = providers[0]?.id ?? "aws";
  const [form, setForm] = useState<AccountFormInput>(() => createDefaultForm(fallbackProvider));
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string>();
  const [testingConnection, setTestingConnection] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testHint, setTestHint] = useState<string>();

  useEffect(() => {
    if (!open) return;
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
      });
    } else {
      setForm(createDefaultForm(fallbackProvider));
    }
    setLocalError(undefined);
    setTestStatus("idle");
    setTestHint(undefined);
  }, [open, mode, initialAccount, fallbackProvider]);

  const title = mode === "create" ? "连接 S3 兼容存储" : "编辑账户";
  const submitLabel = mode === "create" ? "创建账户" : "保存修改";
  const submitIcon =
    mode === "create" ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />;

  const handleChange = <K extends keyof AccountFormInput>(field: K, value: AccountFormInput[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const requiredFields: Array<keyof AccountFormInput> =
    mode === "create"
      ? ["name", "endpoint", "accessKeyId", "secretAccessKey"]
      : ["name", "endpoint"];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const missing = requiredFields.find((field) => !String(form[field] ?? "").trim());
    if (missing) {
      setLocalError("请填写所有必填项");
      return;
    }
    setLocalError(undefined);
    setSubmitting(true);
    try {
      if (mode === "create") {
        await accountsStore.createAccount(form);
      } else if (initialAccount) {
        await accountsStore.updateAccount(initialAccount.id, form);
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "操作失败";
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialAccount) return;
    const confirmed = window.confirm(
      `确定要删除账户 “${initialAccount.name}” 吗？此操作不可撤销。`,
    );
    if (!confirmed) return;
    setSubmitting(true);
    try {
      await accountsStore.deleteAccount(initialAccount.id);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const providerOptions = useMemo(() => {
    if (providers.length) return providers;
    return [
      { id: "aws", label: "AWS S3", description: "" },
      { id: "oss", label: "Aliyun OSS", description: "" },
      { id: "cos", label: "Tencent COS", description: "" },
      { id: "r2", label: "Cloudflare R2", description: "" },
    ];
  }, [providers]);

  useEffect(() => {
    setTestStatus("idle");
    setTestHint(undefined);
  }, [
    form.accessKeyId,
    form.secretAccessKey,
    form.endpoint,
    form.region,
    form.provider,
    form.useSSL,
    form.port,
  ]);

  const canRunConnectionTest =
    Boolean(form.endpoint?.trim()) &&
    Boolean(form.accessKeyId?.trim()) &&
    Boolean(form.secretAccessKey?.trim());

  const handleTestConnection = async () => {
    if (!canRunConnectionTest) {
      setLocalError("请先填写 Endpoint、Access Key 与 Secret 后再测试连接");
      return;
    }
    try {
      setTestingConnection(true);
      setLocalError(undefined);
      setTestStatus("idle");
      setTestHint(undefined);
      const result = await accountsStore.testConnectionPreview(form);
      if (result.status === "ok") {
        setTestStatus("ok");
        setTestHint(result.message || "连接正常");
      } else {
        setTestStatus("error");
        setTestHint(result.message || "连接失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "连接测试失败";
      setTestStatus("error");
      setTestHint(message);
    } finally {
      setTestingConnection(false);
    }
  };

  const testMessage =
    testHint ??
    (mode === "edit" && !form.secretAccessKey
      ? "如需测试新配置，请重新输入 Secret"
      : "填写凭证后可快速测试连接是否可用");
  const testMessageClass =
    testStatus === "ok"
      ? "text-emerald-600"
      : testStatus === "error"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent side="right" className="w-full max-w-xl p-0 sm:max-w-xl">
        <SheetHeader className="space-y-1 border-b border-border/60 px-6 py-5">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {mode === "create" ? "配置并连接一个新的 S3 兼容账户" : "更新当前账户的信息"}
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSubmit}
          className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-5"
        >
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="account-name">
                账户名称<span className="text-destructive">*</span>
              </Label>
              <Input
                id="account-name"
                placeholder="如：AWS 主账户"
                value={form.name}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange("name", event.target.value)
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>
                服务商<span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.provider}
                onValueChange={(value) => handleChange("provider", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择服务商" />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2 space-y-2">
              <Label htmlFor="endpoint">
                Endpoint<span className="text-destructive">*</span>
              </Label>
              <Input
                id="endpoint"
                placeholder="https://s3.amazonaws.com"
                value={form.endpoint}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange("endpoint", event.target.value)
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">默认区域</Label>
              <Input
                id="region"
                placeholder="us-east-1 / cn-hangzhou"
                value={form.region}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange("region", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">端口</Label>
              <Input
                id="port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange("port", Number(event.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="access-key">
                Access Key ID
                {mode === "create" ? <span className="text-destructive">*</span> : null}
              </Label>
              <Input
                id="access-key"
                placeholder="AKIA..."
                value={form.accessKeyId ?? ""}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange("accessKeyId", event.target.value)
                }
                required={mode === "create"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-key">
                Secret Access Key
                {mode === "create" ? <span className="text-destructive">*</span> : null}
              </Label>
              <Input
                id="secret-key"
                type="password"
                placeholder={mode === "create" ? "仅本机加密存储" : "留空则保持不变"}
                value={form.secretAccessKey ?? ""}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  handleChange("secretAccessKey", event.target.value)
                }
                required={mode === "create"}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
            <div>
              <Label className="text-sm font-medium">启用 SSL/TLS 访问</Label>
              <p className="text-xs text-muted-foreground">推荐开启以保障凭证与对象传输安全。</p>
            </div>
            <Switch
              checked={form.useSSL}
              onCheckedChange={(checked) => handleChange("useSSL", checked)}
              aria-label="切换 SSL/TLS"
            />
          </div>

          <Alert variant={testStatus === "error" ? "destructive" : "default"} className="space-y-3">
            {testStatus === "error" ? (
              <AlertCircle className="text-destructive" />
            ) : (
              <ShieldCheck />
            )}
            <div>
              <AlertTitle>连接检测</AlertTitle>
              <AlertDescription className={testMessageClass}>{testMessage}</AlertDescription>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleTestConnection}
                disabled={!canRunConnectionTest || testingConnection}
              >
                {testingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                测试连接
              </Button>
            </div>
          </Alert>

          {localError ? (
            <Alert variant="destructive">
              <AlertCircle className="text-destructive" />
              <div>
                <AlertTitle>提交失败</AlertTitle>
                <AlertDescription>{localError}</AlertDescription>
              </div>
            </Alert>
          ) : null}

          <SheetFooter className="gap-4 border-t border-border/60 pt-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                  取消
                </Button>
                <Button type="submit" className="gap-2" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitIcon}
                  {submitLabel}
                </Button>
              </div>
              {mode === "edit" && initialAccount ? (
                <Alert variant="destructive" className="gap-3">
                  <Trash2 className="text-destructive" />
                  <div className="space-y-1">
                    <AlertTitle>危险操作</AlertTitle>
                    <AlertDescription>删除账户将移除所有本地配置，操作不可恢复。</AlertDescription>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                      onClick={handleDelete}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      删除账户
                    </Button>
                  </div>
                </Alert>
              ) : null}
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
