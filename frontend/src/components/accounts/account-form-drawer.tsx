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
import { getFieldErrorMessage } from "@/lib/forms";
import { useForm, useStore } from "@tanstack/react-form";
import { AlertCircle, Loader2, Plus, RefreshCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
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
  provider: z.string().trim().min(1, "请选择服务商"),
  endpoint: z.string().trim().min(1, "Endpoint 不能为空"),
  region: z.string().trim(),
  accessKeyId: z.string().trim().optional(),
  secretAccessKey: z.string().trim().optional(),
  useSSL: z.boolean(),
  port: z
    .number({ invalid_type_error: "端口必须为数字" })
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
            code: z.ZodIssueCode.custom,
            path: ["accessKeyId"],
            message: "Access Key ID 必填",
          });
        }
        if (!data.secretAccessKey?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
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

  const form = useForm<AccountFormInput>({
    defaultValues: defaultFormValues,
    validators: {
      onSubmit: ({ value }) => {
        accountFormSchema.parse(value);
      },
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
    const confirmed = window.confirm(`确定要删除账户“${initialAccount.name}”吗？此操作不可撤销。`);
    if (!confirmed) return;
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
          <div className="grid gap-4">
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
                      {showError ? (
                        <p className="text-xs text-destructive">{errorMessage}</p>
                      ) : null}
                    </div>
                  );
                }}
              </form.Field>
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
                              {provider.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {showError ? (
                        <p className="text-xs text-destructive">{errorMessage}</p>
                      ) : null}
                    </div>
                  );
                }}
              </form.Field>
            </div>
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
                      {showError ? (
                        <p className="text-xs text-destructive">{errorMessage}</p>
                      ) : null}
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
                        type="number"
                        min={1}
                        max={65535}
                        value={displayValue}
                        onChange={(event) => field.handleChange(Number(event.target.value) || 0)}
                        onBlur={field.handleBlur}
                        aria-invalid={showError}
                      />
                      {showError ? (
                        <p className="text-xs text-destructive">{errorMessage}</p>
                      ) : null}
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
                {mode === "create" ? <span className="text-destructive">*</span> : null}
              </Label>
              <form.Field name="accessKeyId">
                {(field) => {
                  const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                  const showError = Boolean(
                    errorMessage && (field.state.meta.isTouched || formSubmitted),
                  );
                  return (
                    <div className="space-y-1">
                      <Input
                        id="access-key"
                        placeholder="AKIA..."
                        value={field.state.value ?? ""}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={showError}
                        required={mode === "create"}
                      />
                      {showError ? (
                        <p className="text-xs text-destructive">{errorMessage}</p>
                      ) : null}
                    </div>
                  );
                }}
              </form.Field>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-key">
                Secret Access Key
                {mode === "create" ? <span className="text-destructive">*</span> : null}
              </Label>
              <form.Field name="secretAccessKey">
                {(field) => {
                  const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                  const showError = Boolean(
                    errorMessage && (field.state.meta.isTouched || formSubmitted),
                  );
                  return (
                    <div className="space-y-1">
                      <Input
                        id="secret-key"
                        type="password"
                        placeholder={mode === "create" ? "仅本机加密存储" : "留空则保持不变"}
                        value={field.state.value ?? ""}
                        onChange={(event) => field.handleChange(event.target.value)}
                        onBlur={field.handleBlur}
                        aria-invalid={showError}
                        required={mode === "create"}
                      />
                      {showError ? (
                        <p className="text-xs text-destructive">{errorMessage}</p>
                      ) : null}
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
              {mode === "edit" && initialAccount ? (
                <Alert variant="destructive" className="gap-3">
                  <Trash2 className="text-destructive" />
                  <div className="space-y-1">
                    <AlertTitle>危险操作</AlertTitle>
                    <AlertDescription>删除账户将移除所有本地配置，操作不可恢复。</AlertDescription>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      type="button"
                      variant="destructive"
                      className="gap-2"
                      onClick={handleDelete}
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
              ) : null}
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};
