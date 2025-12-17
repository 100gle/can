import { queryClient } from "@/lib/queryClient";
import { accountService } from "@/lib/services";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ActiveAccount,
  CreateAccount,
  DeleteAccount,
  Dial,
  DialPreview,
  ListAccounts,
  ProviderFeatures,
  SetActiveAccount,
  SupportedProviders,
  UpdateAccount,
} from "@wailsjs/go/app/App";
import type { accounts as AccountModels, types as ProviderModels } from "@wailsjs/go/models";
import { useEffect, useMemo } from "react";
import { create } from "zustand";

export type AccountModel = AccountModels.Account;
export type ProviderMetadata = ProviderModels.ProviderMetadata;
export type ProviderFeature = ProviderModels.ProviderFeature;

export type AccountFormInput = {
  name: string;
  tag?: string;
  provider: string;
  endpoint: string;
  region: string;
  appId?: string;
  extra?: Record<string, string>;
  accessKeyId?: string;
  secretAccessKey?: string;
  useSSL: boolean;
  port: number;
};

export type DialStatus = {
  status: "idle" | "running" | "ok" | "error";
  message?: string;
  buckets?: string[];
  checkedAt?: string;
};

export type AccountsQueryResult = {
  accounts: AccountModel[];
  providers: ProviderMetadata[];
  features: ProviderFeature[];
  activeAccountId: string | null;
};

export const ACCOUNTS_KEY = ["accounts"];

const normalizeAccount = (record: AccountModels.Account | AccountModel | null | undefined) => {
  if (!record) return null;
  return { ...(record as AccountModel) };
};

const fetchAccounts = async (): Promise<AccountsQueryResult> => {
  const [rawAccounts, providerPayload, featurePayload, activePayload] = await Promise.all([
    ListAccounts(),
    SupportedProviders(),
    ProviderFeatures(),
    ActiveAccount(),
  ]);
  const accounts = rawAccounts.map((record) => normalizeAccount(record)!).filter(Boolean);

  // Resolve active account: Backend > LocalStorage > First Available
  let activeAccountId = normalizeAccount(activePayload as AccountModel | null)?.id ?? null;

  if (!activeAccountId) {
    const storedId = localStorage.getItem("can-active-account-id");
    if (storedId && accounts.some((a) => a.id === storedId)) {
      activeAccountId = storedId;
      // Sync backend asynchronously
      SetActiveAccount(storedId).catch(() => {});
    } else if (accounts.length > 0) {
      activeAccountId = accounts[0].id;
      localStorage.setItem("can-active-account-id", activeAccountId);
      SetActiveAccount(activeAccountId).catch(() => {});
    }
  } else {
    // Backend has active ID, ensure local storage is in sync
    localStorage.setItem("can-active-account-id", activeAccountId);
  }

  return {
    accounts,
    providers: providerPayload,
    features: featurePayload,
    activeAccountId,
  };
};

// UI-only connection test status
type AccountsUIState = {
  dialStatus: Record<string, DialStatus>;
  setDialStatus: (accountId: string, status: DialStatus) => void;
  hydrateAccounts: (accounts: AccountModel[]) => void;
};

const useAccountsUIStore = create<AccountsUIState>((set) => ({
  dialStatus: {},
  setDialStatus: (accountId, status) =>
    set((state) => ({
      dialStatus: { ...state.dialStatus, [accountId]: status },
    })),
  hydrateAccounts: (accounts) =>
    set((state) => {
      const next: Record<string, DialStatus> = {};
      for (const account of accounts) {
        next[account.id] = state.dialStatus[account.id] ?? { status: "idle" };
      }
      return { dialStatus: next };
    }),
}));

export const useAccounts = () => {
  const query = useQuery<AccountsQueryResult>({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) {
      useAccountsUIStore.getState().hydrateAccounts(query.data.accounts);
    }
  }, [query.data]);

  const dialStatus = useAccountsUIStore((state) => state.dialStatus);

  const data = useMemo(
    () => ({
      accounts: query.data?.accounts ?? [],
      providers: query.data?.providers ?? [],
      features: query.data?.features ?? [],
      activeAccountId: query.data?.activeAccountId ?? null,
      loading: query.isPending,
      error: query.error instanceof Error ? query.error.message : undefined,
      dialStatus,
    }),
    [query.data, query.isPending, query.error, dialStatus],
  );

  return {
    ...data,
    refetch: query.refetch,
  };
};

export const getAccountsSnapshot = () =>
  queryClient.getQueryData<AccountsQueryResult>(ACCOUNTS_KEY);

export const prefetchAccounts = () =>
  queryClient.prefetchQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: fetchAccounts,
  });

export const invalidateAccounts = () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });

const buildExtraParams = (input: AccountFormInput): Record<string, string> => {
  const extra = { ...input.extra };
  if (input.appId?.trim()) {
    extra.appId = input.appId.trim();
  }
  return extra;
};

export const useCreateAccount = () => {
  return useMutation({
    mutationFn: async (input: AccountFormInput) => {
      const accessKey = input.accessKeyId?.trim();
      const secret = input.secretAccessKey?.trim();
      const payload: AccountModels.CreateAccountInput = {
        name: input.name,
        tag: input.tag?.trim() ?? "",
        provider: input.provider,
        endpoint: input.endpoint,
        region: input.region,
        extra: buildExtraParams(input),
        accessKeyId: accessKey ?? "",
        secretAccessKey: secret ?? "",
        useSSL: input.useSSL,
        port: input.port,
      };
      const serverAccount = await CreateAccount(payload);
      await setActiveAccount(serverAccount.id);
      return normalizeAccount(serverAccount)!;
    },
    onSuccess: () => invalidateAccounts(),
  });
};

export const useUpdateAccount = () => {
  return useMutation({
    mutationFn: async ({ accountId, input }: { accountId: string; input: AccountFormInput }) => {
      if (!accountId) {
        throw new Error("accountId is required");
      }

      const payload: Partial<AccountModels.UpdateAccountInput> = {
        provider: input.provider,
        name: input.name,
        endpoint: input.endpoint,
        region: input.region,
        port: input.port,
        useSSL: input.useSSL,
        extra: buildExtraParams(input),
      };
      if (typeof input.tag === "string") {
        payload.tag = input.tag.trim();
      }
      if (input.accessKeyId && input.accessKeyId.trim() !== "") {
        payload.accessKeyId = input.accessKeyId.trim();
      }
      if (input.secretAccessKey && input.secretAccessKey.trim() !== "") {
        payload.secretAccessKey = input.secretAccessKey.trim();
      }
      const serverAccount = await UpdateAccount(accountId, payload as any);
      return normalizeAccount(serverAccount)!;
    },
    onSuccess: () => invalidateAccounts(),
  });
};

export const useDeleteAccount = () => {
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (!accountId) return;
      await DeleteAccount(accountId);
      useAccountsUIStore.setState((state) => {
        const { [accountId]: _, ...rest } = state.dialStatus;
        return { dialStatus: rest };
      });
      // If deleted account was active or stored, check in fetchAccounts will handle re-selection
    },
    onSuccess: () => invalidateAccounts(),
  });
};

export const setActiveAccount = async (accountId: string) => {
  if (!accountId) return;
  localStorage.setItem("can-active-account-id", accountId);
  await SetActiveAccount(accountId);
  await invalidateAccounts();
};

export const useDial = () => {
  return useMutation({
    mutationFn: async (accountId: string) => {
      useAccountsUIStore.getState().setDialStatus(accountId, { status: "running" });
      const result = await Dial(accountId);
      useAccountsUIStore.getState().setDialStatus(accountId, {
        status: result.status === "ok" ? "ok" : "error",
        message: result.message,
        buckets: result.buckets, // Store buckets in probe if needed, or separate cache
        checkedAt: result.checkedAt,
      });

      if (result.status !== "ok") {
        throw new Error(result.message || "Connection failed");
      }
      return result;
    },
    onError: (error, accountId) => {
      const message = error instanceof Error ? error.message : "Connection failed";
      useAccountsUIStore.getState().setDialStatus(accountId, {
        status: "error",
        message,
      });
    },
  });
};

export const useDialPreview = () => {
  return useMutation({
    mutationFn: DialPreview,
  });
};

export const exportAccounts = async () => {
  const result = await accountService.exportAccounts();
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.data;
};

export const importAccounts = async () => {
  const result = await accountService.importAccounts();
  if (!result.success) {
    throw new Error(result.error);
  }
  if (!result.data.cancelled) {
    await invalidateAccounts();
  }
  return result.data;
};
