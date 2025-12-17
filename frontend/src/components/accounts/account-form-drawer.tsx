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
import { PasswordInput } from "@/components/ui/password-input";
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
import type { AccountModel, ProviderMetadata } from "@/hooks/useAccounts";
import { getFieldErrorMessage } from "@/lib/forms";
import { useStore } from "@tanstack/react-form";
import { AlertCircle, Loader2, Plus, RefreshCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useAccountForm } from "./use-account-form";

export type AccountFormDrawerProps = {
  open: boolean;
  mode: "create" | "edit";
  providers: ProviderMetadata[];
  initialAccount?: AccountModel;
  onClose: () => void;
};

export const AccountFormDrawer = (props: AccountFormDrawerProps) => {
  const { open, mode, initialAccount, onClose } = props;
  const {
    t,
    form,
    localError,
    dialing,
    dialStatus,
    dialHint,
    deleting,
    showDeleteConfirm,
    setShowDeleteConfirm,
    resetDialStatus,
    handleDial,
    handleDelete,
    providerOptions,
  } = useAccountForm(props);

  const formValues = useStore(form.store, (state) => state.values);
  const formSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const formSubmitted = useStore(form.store, (state) => state.isSubmitted);
  const isBusy = formSubmitting || deleting;

  const title = mode === "create" ? t("account.form.title.create") : t("account.form.title.edit");
  const submitLabel =
    mode === "create" ? t("account.form.submit.create") : t("account.form.submit.edit");
  const submitIcon =
    mode === "create" ? <Plus className="h-4 w-4" /> : <Save className="h-4 w-4" />;

  const dialButtonLabel =
    dialStatus === "ok"
      ? t("account.form.test.button.ok")
      : dialStatus === "error"
        ? t("account.form.test.button.error")
        : t("account.form.test.button.idle");

  const dialButtonIcon = dialing ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : dialStatus === "ok" ? (
    <ShieldCheck className="h-4 w-4" />
  ) : dialStatus === "error" ? (
    <AlertCircle className="h-4 w-4" />
  ) : (
    <RefreshCcw className="h-4 w-4" />
  );

  const dialButtonClass =
    "gap-2 mr-auto" +
    (dialStatus === "ok" ? " text-emerald-600" : dialStatus === "error" ? " text-destructive" : "");

  const canDial =
    Boolean(formValues.endpoint?.trim()) &&
    Boolean(formValues.accessKeyId?.trim()) &&
    Boolean(formValues.secretAccessKey?.trim());

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
          {/* General Info Section */}
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

          {/* Provider Selection */}
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
                        resetDialStatus();
                      }}
                    >
                      <SelectTrigger className="w-full" aria-invalid={showError}>
                        <SelectValue placeholder={t("account.form.field.provider.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            <span className="inline-flex items-center gap-2">
                              <ProviderIcon provider={provider.id} size="sm" className="shrink-0" />
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

          {/* Connection Details */}
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
                          resetDialStatus();
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
                      resetDialStatus();
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
                          resetDialStatus();
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

          {/* COS AppID field - only shown for Tencent COS */}
          {formValues.provider === "cos" && (
            <div className="space-y-2">
              <Label htmlFor="appId">
                AppID
                <span className="text-destructive">*</span>
              </Label>
              <form.Field name="appId">
                {(field) => {
                  const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                  const showError = Boolean(
                    errorMessage && (field.state.meta.isTouched || formSubmitted),
                  );
                  return (
                    <div className="space-y-1">
                      <Input
                        id="appId"
                        placeholder={t("account.form.field.appId.placeholder")}
                        value={field.state.value ?? ""}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          resetDialStatus();
                        }}
                        onBlur={field.handleBlur}
                        aria-invalid={showError}
                      />
                      {showError ? (
                        <p className="text-xs text-destructive">{errorMessage}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t("account.form.field.appId.hint")}
                        </p>
                      )}
                    </div>
                  );
                }}
              </form.Field>
            </div>
          )}

          {/* Credentials */}
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
                      <PasswordInput
                        id="access-key"
                        placeholder={t("account.form.field.accessKeyId.placeholder")}
                        value={field.state.value ?? ""}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          resetDialStatus();
                        }}
                        onBlur={field.handleBlur}
                        aria-invalid={showError}
                        required={mode === "create"}
                        showToggle
                      />
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
                      <PasswordInput
                        id="secret-key"
                        placeholder={
                          mode === "create"
                            ? t("account.form.field.secretAccessKey.placeholder.create")
                            : t("account.form.field.secretAccessKey.placeholder.edit")
                        }
                        value={field.state.value ?? ""}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                          resetDialStatus();
                        }}
                        onBlur={field.handleBlur}
                        aria-invalid={showError}
                        required={mode === "create"}
                        showToggle
                      />
                      {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                    </div>
                  );
                }}
              </form.Field>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
            <div>
              <Label className="text-sm font-medium">{t("account.form.field.useSSL.label")}</Label>
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
                    resetDialStatus();
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
                  className={dialButtonClass}
                  onClick={() => handleDial()}
                  disabled={!canDial || dialing || isBusy}
                  title={dialHint}
                >
                  {dialButtonIcon}
                  {dialButtonLabel}
                </Button>
                <div className="ml-auto flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={onClose} disabled={isBusy}>
                    {t("common.cancel")}
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

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("account.form.delete.confirm.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("account.form.delete.confirm.description", {
                  name: initialAccount?.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {t("common.confirmDelete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
};
