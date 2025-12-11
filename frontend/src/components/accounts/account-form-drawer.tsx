import { ProviderIcon } from "@/components/common/provider-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { getFieldErrorMessage } from "@/lib/forms";
import {
  AccountFormInput,
  accountsStore,
  type AccountModel,
  type ProviderMetadata,
} from "@/state/accounts";
import { useForm, useStore } from "@tanstack/react-form";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

export type AccountFormDrawerProps = {
  open: boolean;
  mode: "create" | "edit";
  providers: ProviderMetadata[];
  initialAccount?: AccountModel;
  onClose: () => void;
};

const createDefaultForm = (providerId?: string): AccountFormInput => ({
  name: "",
  tag: "",
  provider: providerId ?? "aws",
  endpoint: "",
  region: "",
  accessKeyId: "",
  secretAccessKey: "",
  useSSL: true,
  port: 443,
});

const accountFormBaseSchema = z.object({
  name: z.string().trim().min(1, "账户名称不能为空"),
  tag: z.string().trim().max(64, "标签最多 64 个字符").optional().or(z.literal("")),
  provider: z.string().trim().min(1, "请选择服务商"),
  endpoint: z.string().trim().min(1, "Endpoint 不能为空"),
  region: z.string().trim(),
  accessKeyId: z.string().trim().optional(),
  secretAccessKey: z.string().trim().optional(),
  useSSL: z.boolean(),
  port: z
    .number({ error: "端口必须为数字" })
    .int("端口必须为整数")
    .min(1, "端口需在 1-65535 之间")
    .max(65535, "端口需在 1-65535 之间"),
});

export const AccountFormDrawer = ({
  open,
  mode,
  providers,
  initialAccount,
  onClose,
}: AccountFormDrawerProps) => {
  const fallbackProvider = providers[0]?.id ?? "aws";
  const defaultFormValues = useMemo<AccountFormInput>(() => {
    if (mode === "edit" && initialAccount) {
      return {
        name: initialAccount.name,
        tag: initialAccount.tag ?? "",
        provider: initialAccount.provider,
        endpoint: initialAccount.endpoint,
        region: initialAccount.region,
        accessKeyId: "",
        secretAccessKey: "",
        useSSL: initialAccount.useSSL,
        port: initialAccount.port,
      };
    }
    return createDefaultForm(fallbackProvider);
  }, [mode, initialAccount, fallbackProvider]);

  const accountFormSchema = useMemo(() => {
    return accountFormBaseSchema.superRefine((data, ctx) => {
      if (mode === "create") {
        if (!data.accessKeyId?.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["accessKeyId"],
            message: "Access Key ID 必填",
          });
        }
        if (!data.secretAccessKey?.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["secretAccessKey"],
            message: "Secret Access Key 必填",
          });
        }
      }
    });
  }, [mode]);

  const [localError, setLocalError] = useState<string>();
  const [testingConnection, setTestingConnection] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testHint, setTestHint] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);

  const form = useForm({
    defaultValues: defaultFormValues,
    validators: {
      onSubmit: accountFormSchema,
      onChange: accountFormSchema,
    },
    onSubmit: async ({ value }) => {
      setLocalError(undefined);
      try {
        if (mode === "create") {
          await accountsStore.createAccount(value);
        } else if (initialAccount) {
          await accountsStore.updateAccount(initialAccount.id, value);
        }
        onClose();
      } catch (error) {
        const message = error instanceof Error ? error.message : "操作失败";
        setLocalError(message);
        throw error;
      }
    },
  });

  const formValues = useStore(form.store, (state) => state.values);
  const formSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const formSubmitted = useStore(form.store, (state) => state.isSubmitted);
  const isBusy = formSubmitting || deleting;

  useEffect(() => {
    if (!open) return;
    form.reset(defaultFormValues);
    setLocalError(undefined);
    setTestStatus("idle");
    setTestHint(undefined);
    setTestingConnection(false);
    setDeleting(false);
  }, [open, defaultFormValues, form]);

  const title = mode === "create" ? "连接 S3 兼容存储" : "编辑账户";
  const submitLabel = mode === "create" ? "创建账户" : "保存修改";
  const submitIcon =
    mode === "create" ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />;

  const providerOptions = useMemo(() => {
    if (providers.length) return providers;
    return [
      { id: "aws", label: "AWS S3", description: "测试" },
      { id: "oss", label: "Aliyun OSS", description: "" },
      { id: "cos", label: "Tencent COS", description: "" },
      { id: "r2", label: "Cloudflare R2", description: "" },
      { id: "qiniu", label: "Qiniu Kodo", description: "" },
      { id: "minio", label: "MinIO", description: "" },
      { id: "custom", label: "Generic S3", description: "" },
    ];
  }, [providers]);

  useEffect(() => {
    setTestStatus("idle");
    setTestHint(undefined);
  }, [
    formValues.accessKeyId,
    formValues.secretAccessKey,
    formValues.endpoint,
    formValues.region,
    formValues.provider,
    formValues.useSSL,
    formValues.port,
  ]);

  const normalizedEndpoint = formValues.endpoint?.trim() ?? "";
  const normalizedAccessKey = formValues.accessKeyId?.trim() ?? "";
  const normalizedSecret = formValues.secretAccessKey?.trim() ?? "";

  const canRunConnectionTest =
    Boolean(normalizedEndpoint) && Boolean(normalizedAccessKey) && Boolean(normalizedSecret);

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
      const payload: AccountFormInput = {
        ...form.state.values,
        endpoint: normalizedEndpoint,
        accessKeyId: normalizedAccessKey,
        secretAccessKey: normalizedSecret,
      };
      const result = await accountsStore.testConnectionPreview(payload);
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

  const handleDelete = async () => {
    if (!initialAccount) return;
    setShowDeleteConfirm(false);
    setDeleting(true);
    try {
      await accountsStore.deleteAccount(initialAccount.id);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      setLocalError(message);
    } finally {
      setDeleting(false);
    }
  };

  const testButtonLabel =
    testStatus === "ok" ? "连接已验证" : testStatus === "error" ? "测试失败" : "测试连接";
  const testButtonIcon = testingConnection ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : testStatus === "ok" ? (
    <ShieldCheck className="h-4 w-4" />
  ) : testStatus === "error" ? (
    <AlertCircle className="h-4 w-4" />
  ) : (
    <RefreshCcw className="h-4 w-4" />
  );
  const testButtonTitle =
    testHint ??
    (mode === "edit" && !normalizedSecret
      ? "如需测试新配置，请重新输入 Secret"
      : "填写凭证后可快速测试连接是否可用");
  const testButtonClass =
    "gap-2 mr-auto" +
    (testStatus === "ok" ? " text-emerald-600" : testStatus === "error" ? " text-destructive" : "");

  return (
    <>
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
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
            className="flex h-full flex-col gap-6 overflow-y-auto px-6 py-5"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="account-name">
                  账户名称<span className="text-destructive">*</span>
                </Label>
                <form.Field name="name">
                  {(field) => {
                    const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                    const showError = Boolean(
                      errorMessage && (field.state.meta.isTouched || formSubmitted),
                    );
                    return (
                      <div className="space-y-1">
                        <Input
                          id="account-name"
                          placeholder="如：AWS 主账户"
                          value={field.state.value ?? ""}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                          aria-invalid={showError}
                          required
                        />
                        {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                      </div>
                    );
                  }}
                </form.Field>
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-tag">标签</Label>
                <form.Field name="tag">
                  {(field) => {
                    const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                    const showError = Boolean(
                      errorMessage && (field.state.meta.isTouched || formSubmitted),
                    );
                    return (
                      <div className="space-y-1">
                        <Input
                          id="account-tag"
                          placeholder="如：生产集群 A"
                          value={field.state.value ?? ""}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                          aria-invalid={showError}
                        />
                        {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                      </div>
                    );
                  }}
                </form.Field>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                服务商<span className="text-destructive">*</span>
              </Label>
              <form.Field name="provider">
                {(field) => {
                  const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                  const showError = Boolean(
                    errorMessage && (field.state.meta.isTouched || formSubmitted),
                  );
                  return (
                    <div className="space-y-1">
                      <Select
                        value={field.state.value}
                        onValueChange={(value) => {
                          field.handleChange(value);
                          field.handleBlur();
                        }}
                      >
                        <SelectTrigger className="w-full" aria-invalid={showError}>
                          <SelectValue placeholder="选择服务商" />
                        </SelectTrigger>
                        <SelectContent>
                          {providerOptions.map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              <span className="inline-flex items-center gap-2">
                                <ProviderIcon
                                  provider={provider.id}
                                  size="sm"
                                  className="shrink-0"
                                />
                                <span>{provider.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                    </div>
                  );
                }}
              </form.Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="lg:col-span-2 space-y-2">
                <Label htmlFor="endpoint">
                  Endpoint<span className="text-destructive">*</span>
                </Label>
                <form.Field name="endpoint">
                  {(field) => {
                    const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                    const showError = Boolean(
                      errorMessage && (field.state.meta.isTouched || formSubmitted),
                    );
                    return (
                      <div className="space-y-1">
                        <Input
                          id="endpoint"
                          placeholder="https://s3.amazonaws.com"
                          value={field.state.value ?? ""}
                          onChange={(event) => field.handleChange(event.target.value)}
                          onBlur={field.handleBlur}
                          aria-invalid={showError}
                          required
                        />
                        {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                      </div>
                    );
                  }}
                </form.Field>
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">默认区域</Label>
                <form.Field name="region">
                  {(field) => (
                    <Input
                      id="region"
                      placeholder="us-east-1 / cn-hangzhou"
                      value={field.state.value ?? ""}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">端口</Label>
                <form.Field name="port">
                  {(field) => {
                    const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                    const showError = Boolean(
                      errorMessage && (field.state.meta.isTouched || formSubmitted),
                    );
                    const displayValue =
                      typeof field.state.value === "number" && Number.isFinite(field.state.value)
                        ? String(field.state.value)
                        : "";
                    return (
                      <div className="space-y-1">
                        <Input
                          id="port"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="443"
                          value={displayValue}
                          onChange={(event) => {
                            const val = event.target.value.replace(/\D/g, "");
                            field.handleChange(val ? Number(val) : 0);
                          }}
                          onBlur={field.handleBlur}
                          aria-invalid={showError}
                        />
                        {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                      </div>
                    );
                  }}
                </form.Field>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="access-key">
                  Access Key ID
                  {mode === "create" && <span className="text-destructive">*</span>}
                </Label>
                <form.Field name="accessKeyId">
                  {(field) => {
                    const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                    const showError = Boolean(
                      errorMessage && (field.state.meta.isTouched || formSubmitted),
                    );
                    return (
                      <div className="space-y-1">
                        <div className="relative">
                          <Input
                            id="access-key"
                            type={showAccessKey ? "text" : "password"}
                            placeholder="AKIA..."
                            value={field.state.value ?? ""}
                            onChange={(event) => field.handleChange(event.target.value)}
                            onBlur={field.handleBlur}
                            aria-invalid={showError}
                            required={mode === "create"}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowAccessKey(!showAccessKey)}
                            tabIndex={-1}
                            aria-label={showAccessKey ? "隐藏 Access Key" : "显示 Access Key"}
                          >
                            {showAccessKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                      </div>
                    );
                  }}
                </form.Field>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret-key">
                  Secret Access Key
                  {mode === "create" && <span className="text-destructive">*</span>}
                </Label>
                <form.Field name="secretAccessKey">
                  {(field) => {
                    const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                    const showError = Boolean(
                      errorMessage && (field.state.meta.isTouched || formSubmitted),
                    );
                    return (
                      <div className="space-y-1">
                        <div className="relative">
                          <Input
                            id="secret-key"
                            type={showSecretKey ? "text" : "password"}
                            placeholder={mode === "create" ? "仅本机加密存储" : "留空则保持不变"}
                            value={field.state.value ?? ""}
                            onChange={(event) => field.handleChange(event.target.value)}
                            onBlur={field.handleBlur}
                            aria-invalid={showError}
                            required={mode === "create"}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setShowSecretKey(!showSecretKey)}
                            tabIndex={-1}
                            aria-label={showSecretKey ? "隐藏 Secret Key" : "显示 Secret Key"}
                          >
                            {showSecretKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                      </div>
                    );
                  }}
                </form.Field>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div>
                <Label className="text-sm font-medium">启用 SSL/TLS 访问</Label>
                <p className="text-xs text-muted-foreground">推荐开启以保障凭证与对象传输安全。</p>
              </div>
              <form.Field name="useSSL">
                {(field) => (
                  <Switch
                    checked={field.state.value}
                    onCheckedChange={(checked) => field.handleChange(checked)}
                    onBlur={field.handleBlur}
                    aria-label="切换 SSL/TLS"
                  />
                )}
              </form.Field>
            </div>

            {localError && (
              <Alert variant="destructive">
                <AlertCircle className="text-destructive" />
                <div>
                  <AlertTitle>提交失败</AlertTitle>
                  <AlertDescription>{localError}</AlertDescription>
                </div>
              </Alert>
            )}

            <SheetFooter className="gap-4 border-t border-border/60 pt-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className={testButtonClass}
                    onClick={handleTestConnection}
                    disabled={!canRunConnectionTest || testingConnection || isBusy}
                    title={testButtonTitle}
                  >
                    {testButtonIcon}
                    {testButtonLabel}
                  </Button>
                  <div className="ml-auto flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isBusy}>
                      取消
                    </Button>
                    <Button type="submit" className="gap-2" disabled={isBusy}>
                      {formSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitIcon}
                      {submitLabel}
                    </Button>
                  </div>
                </div>
                {mode === "edit" && initialAccount && (
                  <Alert variant="destructive" className="gap-3">
                    <Trash2 className="text-destructive" />
                    <div className="space-y-1">
                      <AlertTitle>危险操作</AlertTitle>
                      <AlertDescription>
                        删除账户将移除所有本地配置，操作不可恢复。
                      </AlertDescription>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        variant="destructive"
                        className="gap-2"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={isBusy}
                      >
                        {deleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        删除账户
                      </Button>
                    </div>
                  </Alert>
                )}
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除账户？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除账户"{initialAccount?.name}"，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
