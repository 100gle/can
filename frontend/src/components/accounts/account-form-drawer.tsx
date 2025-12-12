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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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

export const AccountFormDrawer = ({
  open,
  mode,
  providers,
  initialAccount,
  onClose,
}: AccountFormDrawerProps) => {
  const { t } = useTranslation("common");
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
    const baseSchema = z.object({
      name: z.string().trim().min(1, t("account.form.field.name.error.required")),
      tag: z
        .string()
        .trim()
        .max(64, t("account.form.field.tag.error.maxLength"))
        .optional()
        .or(z.literal("")),
      provider: z.string().trim().min(1, t("account.form.field.provider.error.required")),
      endpoint: z.string().trim().min(1, t("account.form.field.endpoint.error.required")),
      region: z.string().trim(),
      accessKeyId: z.string().trim().optional(),
      secretAccessKey: z.string().trim().optional(),
      useSSL: z.boolean(),
      port: z
        .number({ error: t("account.form.field.port.error.number") })
        .int(t("account.form.field.port.error.integer"))
        .min(1, t("account.form.field.port.error.range"))
        .max(65535, t("account.form.field.port.error.range")),
    });

    return baseSchema.superRefine((data, ctx) => {
      if (mode === "create") {
        if (!data.accessKeyId?.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["accessKeyId"],
            message: t("account.form.field.accessKeyId.error.required"),
          });
        }
        if (!data.secretAccessKey?.trim()) {
          ctx.addIssue({
            code: "custom",
            path: ["secretAccessKey"],
            message: t("account.form.field.secretAccessKey.error.required"),
          });
        }
      }
    });
  }, [mode, t]);

  const [localError, setLocalError] = useState<string>();
  const [testingConnection, setTestingConnection] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "error">("idle");
  const [testHint, setTestHint] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const resetTestStatus = useCallback(() => {
    setTestStatus((prev) => (prev === "idle" ? prev : "idle"));
    setTestHint((prev) => (prev === undefined ? prev : undefined));
  }, []);

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
        const message =
          error instanceof Error ? error.message : t("account.form.error.operationFailed");
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

  const title = mode === "create" ? t("account.form.title.create") : t("account.form.title.edit");
  const submitLabel =
    mode === "create" ? t("account.form.submit.create") : t("account.form.submit.edit");
  const submitIcon =
    mode === "create" ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />;

  const providerOptions = useMemo(() => {
    if (providers.length) return providers;
    return [
      { id: "aws", label: "AWS S3", description: "" },
      { id: "oss", label: "Aliyun OSS", description: "" },
      { id: "cos", label: "Tencent COS", description: "" },
      { id: "r2", label: "Cloudflare R2", description: "" },
      { id: "qiniu", label: "Qiniu Kodo", description: "" },
      { id: "minio", label: "MinIO", description: "" },
      { id: "custom", label: "Generic S3", description: "" },
    ];
  }, [providers]);

  const normalizedEndpoint = formValues.endpoint?.trim() ?? "";
  const normalizedAccessKey = formValues.accessKeyId?.trim() ?? "";
  const normalizedSecret = formValues.secretAccessKey?.trim() ?? "";

  const canRunConnectionTest =
    Boolean(normalizedEndpoint) && Boolean(normalizedAccessKey) && Boolean(normalizedSecret);

  const handleTestConnection = async () => {
    if (!canRunConnectionTest) {
      setLocalError(t("account.form.test.error.missingFields"));
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
        setTestHint(result.message || t("account.form.test.success"));
      } else {
        setTestStatus("error");
        setTestHint(result.message || t("account.form.test.error.failed"));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.form.test.error.failed");
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
      const message = error instanceof Error ? error.message : t("account.form.error.deleteFailed");
      setLocalError(message);
    } finally {
      setDeleting(false);
    }
  };

  const testButtonLabel =
    testStatus === "ok"
      ? t("account.form.test.button.ok")
      : testStatus === "error"
        ? t("account.form.test.button.error")
        : t("account.form.test.button.idle");
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
      ? t("account.form.test.title.hintEdit")
      : t("account.form.test.title.hint"));
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
              {mode === "create"
                ? t("account.form.description.create")
                : t("account.form.description.edit")}
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
                  {t("account.form.field.name.label")}
                  <span className="text-destructive">*</span>
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
                          placeholder={t("account.form.field.name.placeholder")}
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
                <Label htmlFor="account-tag">{t("account.form.field.tag.label")}</Label>
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
                          placeholder={t("account.form.field.tag.placeholder")}
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
                {t("account.form.field.provider.label")}
                <span className="text-destructive">*</span>
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
                          resetTestStatus();
                        }}
                      >
                        <SelectTrigger className="w-full" aria-invalid={showError}>
                          <SelectValue placeholder={t("account.form.field.provider.placeholder")} />
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
                  Endpoint
                  <span className="text-destructive">*</span>
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
                          placeholder={t("account.form.field.endpoint.placeholder")}
                          value={field.state.value ?? ""}
                          onChange={(event) => {
                            field.handleChange(event.target.value);
                            resetTestStatus();
                          }}
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
                <Label htmlFor="region">{t("account.form.field.region.label")}</Label>
                <form.Field name="region">
                  {(field) => (
                    <Input
                      id="region"
                      placeholder={t("account.form.field.region.placeholder")}
                      value={field.state.value ?? ""}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                        resetTestStatus();
                      }}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">{t("account.form.field.port.label")}</Label>
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
                          placeholder={t("account.form.field.port.placeholder")}
                          value={displayValue}
                          onChange={(event) => {
                            const val = event.target.value.replace(/\D/g, "");
                            field.handleChange(val ? Number(val) : 0);
                            resetTestStatus();
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
                            placeholder={t("account.form.field.accessKeyId.placeholder")}
                            value={field.state.value ?? ""}
                            onChange={(event) => {
                              field.handleChange(event.target.value);
                              resetTestStatus();
                            }}
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
                            aria-label={
                              showAccessKey
                                ? t("account.form.field.accessKeyId.hide")
                                : t("account.form.field.accessKeyId.show")
                            }
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
                            placeholder={
                              mode === "create"
                                ? t("account.form.field.secretAccessKey.placeholder.create")
                                : t("account.form.field.secretAccessKey.placeholder.edit")
                            }
                            value={field.state.value ?? ""}
                            onChange={(event) => {
                              field.handleChange(event.target.value);
                              resetTestStatus();
                            }}
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
                            aria-label={
                              showSecretKey
                                ? t("account.form.field.secretAccessKey.hide")
                                : t("account.form.field.secretAccessKey.show")
                            }
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
                <Label className="text-sm font-medium">
                  {t("account.form.field.useSSL.label")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("account.form.field.useSSL.description")}
                </p>
              </div>
              <form.Field name="useSSL">
                {(field) => (
                  <Switch
                    checked={field.state.value}
                    onCheckedChange={(checked) => {
                      field.handleChange(checked);
                      resetTestStatus();
                    }}
                    onBlur={field.handleBlur}
                    aria-label={t("account.form.field.useSSL.aria")}
                  />
                )}
              </form.Field>
            </div>

            {localError && (
              <Alert variant="destructive">
                <AlertCircle className="text-destructive" />
                <div>
                  <AlertTitle>{t("account.form.error.submitFailed")}</AlertTitle>
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
                      {t("cancel")}
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
                      <AlertTitle>{t("account.form.delete.title")}</AlertTitle>
                      <AlertDescription>{t("account.form.delete.description")}</AlertDescription>
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
                        {t("account.form.delete.button")}
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
            <AlertDialogTitle>{t("account.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("account.deleteConfirmDesc", { name: initialAccount?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
