import type { ProviderMetadata } from "@/hooks/useAccounts";
import {
  type AccountModel,
  useCreateAccount,
  useDeleteAccount,
  useDialPreview,
  useUpdateAccount,
} from "@/hooks/useAccounts";
import { logger } from "@/lib/logger";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type AccountFormInput,
  createDefaultForm,
  defaultProviderOptions,
  getAccountFormSchema,
} from "./account-form-schema";

type UseAccountFormProps = {
  open: boolean;
  mode: "create" | "edit";
  providers: ProviderMetadata[];
  initialAccount?: AccountModel;
  onClose: () => void;
};

export const useAccountForm = ({
  open,
  mode,
  providers,
  initialAccount,
  onClose,
}: UseAccountFormProps) => {
  const { t } = useTranslation("common");
  const queryClient = useQueryClient();
  const fallbackProvider = providers[0]?.id ?? "aws";

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Mutations
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  // Use the renamed hook
  const dialPreview = useDialPreview();

  const resetDialStatus = () => {
    dialPreview.reset();
  };

  const defaultFormValues = useMemo<AccountFormInput>(() => {
    if (mode === "edit" && initialAccount) {
      return {
        name: initialAccount.name,
        tag: initialAccount.tag ?? "",
        provider: initialAccount.provider,
        endpoint: initialAccount.endpoint,
        region: initialAccount.region,
        appId: initialAccount.extra?.appId ?? "",
        accessKeyId: "", // Will be loaded async
        secretAccessKey: "", // Will be loaded async
        useSSL: initialAccount.useSSL,
        port: initialAccount.port,
        extra: initialAccount.extra,
      };
    }
    return createDefaultForm(fallbackProvider);
  }, [mode, initialAccount, fallbackProvider]);

  const accountFormSchema = useMemo(() => getAccountFormSchema(t, mode), [mode, t]);

  const form = useForm({
    defaultValues: defaultFormValues,
    validators: {
      onSubmit: accountFormSchema,
      onChange: accountFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        if (mode === "create") {
          await createAccount.mutateAsync(value);
        } else if (initialAccount) {
          await updateAccount.mutateAsync({
            accountId: initialAccount.id,
            input: value,
          });
        }
        onClose();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : t("account.form.error.operationFailed");
        logger.error("accountForm.submit", "Account operation failed", {
          mode,
          accountId: initialAccount?.id,
          error: message,
          rawError: error,
        });
        throw error;
      }
    },
  });

  // State initialization and credential loading
  useEffect(() => {
    if (!open) return;
    form.reset(defaultFormValues);
    dialPreview.reset();
    createAccount.reset();
    updateAccount.reset();
    deleteAccount.reset();
    setShowDeleteConfirm(false);

    // Load credentials for edit mode
    if (mode === "edit" && initialAccount?.id) {
      import("@wailsjs/go/app/App").then(({ GetAccountCredentials }) => {
        GetAccountCredentials(initialAccount.id)
          .then((creds: { accessKeyId: string; secretAccessKey: string }) => {
            if (creds.accessKeyId) {
              form.setFieldValue("accessKeyId", creds.accessKeyId);
            }
            if (creds.secretAccessKey) {
              form.setFieldValue("secretAccessKey", creds.secretAccessKey);
            }
          })
          .catch((err: Error) => {
            logger.warn("accountForm.loadCredentials", "Failed to load credentials", {
              accountId: initialAccount.id,
              error: err.message,
            });
          });
      });
    }
  }, [open, defaultFormValues, form, mode, initialAccount?.id]);

  const providerOptions = useMemo(() => {
    if (providers.length) return providers;
    return defaultProviderOptions;
  }, [providers]);

  // Connection Testing Logic
  const handleDial = async () => {
    const values = form.state.values;
    // We strictly validate before testing
    const res = await form.validateAllFields("submit");
    if (res.length > 0) {
      return;
    }

    dialPreview.mutate(
      {
        ...values,
        tag: values.tag ?? "",
        accessKeyId: values.accessKeyId ?? "",
        secretAccessKey: values.secretAccessKey ?? "",
        extra: values.extra ?? {},
      },
      {
        onSuccess: (data) => {
          if (data.status === "ok") {
            if (data.buckets && initialAccount?.id) {
              // Map simple strings to BucketDescriptor structure to satisfy cache
              const bucketModels = data.buckets.map((name) => ({
                name,
                createdAt: new Date().toISOString(),
                region: "",
                objectCount: 0,
                size: 0,
              }));
              queryClient.setQueryData(["buckets", initialAccount.id], { buckets: bucketModels });
            }
          }
        },
      },
    );
  };

  const handleDelete = async () => {
    if (!initialAccount) return;
    setShowDeleteConfirm(false);
    try {
      await deleteAccount.mutateAsync(initialAccount.id);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("account.form.error.deleteFailed");
      logger.error("accountForm.delete", "Delete account failed", {
        accountId: initialAccount.id,
        error: message,
        rawError: error,
      });
    }
  };

  // Derive status from mutations
  const dialing = dialPreview.isPending;
  const dialStatus = dialPreview.data?.status || (dialPreview.isError ? "error" : undefined);
  const dialHint = dialPreview.data?.message || (dialPreview.error as Error)?.message;

  const deleting = deleteAccount.isPending;
  const localError =
    createAccount.error || updateAccount.error || deleteAccount.error
      ? ((createAccount.error || updateAccount.error || deleteAccount.error) as Error).message
      : undefined;

  return {
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
  };
};
