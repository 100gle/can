import { isDesktopMode } from "@/lib/bridge";
import { accountService } from "@/lib/services";
import {
  ActiveAccount,
  CreateAccount,
  DeleteAccount,
  ListAccounts,
  ProviderCapabilities,
  SetActiveAccount,
  SupportedProviders,
  TestAccountConnection,
  TestAccountConnectionPreview,
  UpdateAccount,
} from "@wailsjs/go/app/App";
import type { accounts as AccountModels, types as ProviderModels } from "@wailsjs/go/models";
import { create } from "zustand";

export type AccountModel = AccountModels.Account;
export type ProviderMetadata = ProviderModels.ProviderMetadata;
export type ProviderCapability = ProviderModels.ProviderCapability;

export type ConnectionProbe = {
  status: "idle" | "running" | "ok" | "error";
  message?: string;
  checkedAt?: string;
};

export type AccountsState = {
  accounts: AccountModel[];
  providers: ProviderMetadata[];
  capabilities: ProviderCapability[];
  loading: boolean;
  error?: string;
  activeAccountId: string | null;
  connectionTests: Record<string, ConnectionProbe>;
};

export type AccountFormInput = {
  name: string;
  tag?: string;
  provider: string;
  endpoint: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  useSSL: boolean;
  port: number;
};

type WailsAccount = AccountModels.Account;

type WailsCreateInput = AccountModels.CreateAccountInput;

type WailsExportSummary = AccountModels.ExportSummary;

type WailsImportSummary = AccountModels.ImportSummary;

type AccountsActions = {
  bootstrap: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveAccount: (accountId: string) => Promise<void>;
  createAccount: (input: AccountFormInput) => Promise<AccountModel>;
  testConnection: (accountId: string) => Promise<void>;
  testConnectionPreview: (input: AccountFormInput) => Promise<AccountModels.ConnectionTestResult>;
  updateAccount: (accountId: string, input: AccountFormInput) => Promise<AccountModel>;
  deleteAccount: (accountId: string) => Promise<void>;
  exportAccounts: () => Promise<WailsExportSummary | undefined>;
  importAccounts: () => Promise<WailsImportSummary | undefined>;
};

type AccountsStore = AccountsState & AccountsActions;

const clone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const normalizeAccount = (
  record: AccountModels.Account | AccountModel | null | undefined,
): AccountModel | null => {
  if (!record) return null;
  return { ...(record as AccountModel) };
};

const normalizeAccountList = (records: AccountModels.Account[]): AccountModel[] => {
  return records.map((record) => normalizeAccount(record)!).filter(Boolean);
};

const maskAccessKey = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return trimmed;
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-2)}`;
};

const buildLocalAccount = (input: AccountFormInput, providerLabel: string): AccountModel => {
  const now = new Date().toISOString();
  const accessKey = input.accessKeyId ?? "";
  return {
    id: `local-${Date.now()}`,
    name: input.name,
    tag: input.tag ?? "",
    provider: input.provider,
    providerLabel: providerLabel || input.provider.toUpperCase(),
    endpoint: input.endpoint,
    region: input.region,
    useSSL: input.useSSL,
    port: input.port,
    accessKeyPreview: maskAccessKey(accessKey),
    hasSecret: true,
    createdAt: now,
    updatedAt: now,
  };
};

const FALLBACK_PROVIDERS: ProviderMetadata[] = [
  { id: "aws", label: "AWS S3", description: "Amazon S3 Regions & GovCloud" },
  { id: "oss", label: "Aliyun OSS", description: "Object Storage Service" },
  { id: "cos", label: "Tencent COS", description: "Tencent Cloud Object Storage" },
  { id: "r2", label: "Cloudflare R2", description: "Durable object storage" },
];

const FALLBACK_CAPABILITIES: ProviderCapability[] = [
  {
    provider: "aws",
    featureId: "bucket.storage_class",
    name: "自定义存储类型",
    description: "标准、低频、归档等",
    supported: true,
    message: "",
  },
  {
    provider: "cos",
    featureId: "bucket.multi_az",
    name: "多 AZ 冗余",
    description: "跨可用区冗余策略",
    supported: true,
    message: "",
  },
  {
    provider: "oss",
    featureId: "bucket.multi_az",
    name: "多 AZ 冗余",
    description: "跨可用区冗余策略",
    supported: false,
    message: "阿里云 OSS 暂未开放跨可用区开关。",
  },
  {
    provider: "r2",
    featureId: "object.symlink",
    name: "对象软链接",
    description: "为对象创建软链接引用",
    supported: false,
    message: "Cloudflare R2 暂不支持软链接。",
  },
];

const initialState: AccountsState = {
  accounts: [],
  providers: [],
  capabilities: [],
  loading: false,
  error: undefined,
  activeAccountId: null,
  connectionTests: {},
};

let hydrationPromise: Promise<void> | undefined;

const useAccountsStoreBase = create<AccountsStore>((set, get) => ({
  ...initialState,
  bootstrap: async () => {
    if (!hydrationPromise) {
      hydrationPromise = get()
        .refresh()
        .catch((error) => {
          hydrationPromise = undefined;
          throw error;
        });
    }
    return hydrationPromise;
  },
  refresh: async () => {
    set({ loading: true, error: undefined });
    const useBridge = isDesktopMode();
    try {
      let accounts: AccountModel[] = [];
      let providers: ProviderMetadata[] = [];
      let capabilities: ProviderCapability[] = [];
      let active: AccountModel | null = null;

      if (useBridge) {
        const [rawAccounts, providerPayload, capabilityPayload, activePayload] = await Promise.all([
          ListAccounts(),
          SupportedProviders(),
          ProviderCapabilities(),
          ActiveAccount(),
        ]);
        accounts = normalizeAccountList(rawAccounts);
        providers = providerPayload;
        capabilities = capabilityPayload;
        active = normalizeAccount(activePayload as WailsAccount | null);
      } else {
        accounts = [];
        providers = clone(FALLBACK_PROVIDERS);
        capabilities = clone(FALLBACK_CAPABILITIES);
        active = null;
      }

      const derivedId = (active ? active.id : undefined) ?? accounts[0]?.id ?? null;
      const prevTests = get().connectionTests;
      const connectionTests = accounts.reduce<Record<string, ConnectionProbe>>((acc, account) => {
        acc[account.id] = prevTests[account.id] ?? { status: "idle" };
        return acc;
      }, {});
      set({
        accounts,
        providers,
        capabilities,
        activeAccountId: derivedId,
        loading: false,
        error: undefined,
        connectionTests,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载账户失败";
      set({ loading: false, error: message });
      throw error;
    }
  },
  setActiveAccount: async (accountId: string) => {
    if (get().activeAccountId === accountId) return;
    const useBridge = isDesktopMode();
    try {
      set({ loading: true, error: undefined });
      if (useBridge) {
        await SetActiveAccount(accountId);
      }
      set((state) => ({
        activeAccountId: accountId,
        loading: false,
        connectionTests: {
          ...state.connectionTests,
          [accountId]: state.connectionTests[accountId] ?? { status: "idle" },
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "切换账户失败";
      set({ loading: false, error: message });
      throw error;
    }
  },
  createAccount: async (input: AccountFormInput) => {
    const useBridge = isDesktopMode();
    const accessKey = input.accessKeyId?.trim();
    const secret = input.secretAccessKey?.trim();
    const tag = input.tag?.trim() ?? "";
    if (!accessKey) {
      throw new Error("accessKeyId is required");
    }
    if (!secret) {
      throw new Error("secretAccessKey is required");
    }
    set({ loading: true, error: undefined });
    try {
      let created: AccountModel | null = null;
      if (useBridge) {
        const payload: WailsCreateInput = {
          name: input.name,
          tag,
          provider: input.provider,
          endpoint: input.endpoint,
          region: input.region,
          accessKeyId: accessKey,
          secretAccessKey: secret,
          useSSL: input.useSSL,
          port: input.port,
        };
        const serverAccount = await CreateAccount(payload);
        await SetActiveAccount(serverAccount.id);
        created = normalizeAccount(serverAccount);
      } else {
        const providerLabel =
          get().providers.find((item) => item.id === input.provider)?.label ?? input.provider;
        created = buildLocalAccount({ ...input, accessKeyId: accessKey, tag }, providerLabel);
      }
      if (!created) {
        throw new Error("创建账户失败");
      }
      set((state) => ({
        accounts: [...state.accounts, created!],
        activeAccountId: created!.id,
        loading: false,
        error: undefined,
        connectionTests: {
          ...state.connectionTests,
          [created!.id]: { status: "idle" },
        },
      }));
      return created;
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建账户失败";
      set({ loading: false, error: message });
      throw error;
    }
  },
  testConnection: async (accountId: string) => {
    const useBridge = isDesktopMode();
    set((state) => ({
      connectionTests: {
        ...state.connectionTests,
        [accountId]: { status: "running" },
      },
    }));
    try {
      const state = get();
      const result = useBridge
        ? await TestAccountConnection(accountId)
        : {
            accountId,
            provider: state.accounts.find((item) => item.id === accountId)?.provider ?? "aws",
            status: "ok",
            message: "示例数据 · 连接稳定",
            checkedAt: new Date().toISOString(),
          };
      set((state) => ({
        connectionTests: {
          ...state.connectionTests,
          [accountId]: {
            status: result.status === "ok" ? "ok" : "error",
            message: result.message,
            checkedAt: result.checkedAt,
          },
        },
      }));
      if (result.status !== "ok") {
        throw new Error(result.message || "连接测试失败");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "连接测试失败";
      set((state) => ({
        connectionTests: {
          ...state.connectionTests,
          [accountId]: { status: "error", message },
        },
      }));
      throw new Error(message);
    }
  },
  testConnectionPreview: async (input: AccountFormInput) => {
    const payload: WailsCreateInput = {
      name: (input.name ?? "").trim() || "连接测试",
      tag: (input.tag ?? "").trim(),
      provider: (input.provider ?? "aws") as any,
      endpoint: (input.endpoint ?? "").trim(),
      accessKeyId: (input.accessKeyId ?? "").trim(),
      secretAccessKey: (input.secretAccessKey ?? "").trim(),
      region: (input.region ?? "").trim(),
      useSSL: typeof input.useSSL === "boolean" ? input.useSSL : true,
      port: input.port || 443,
    };
    const useBridge = isDesktopMode();
    if (!useBridge) {
      return {
        accountId: "",
        provider: payload.provider,
        status: "ok",
        message: "本地模式已跳过真实连接测试",
        checkedAt: new Date().toISOString(),
      } as AccountModels.ConnectionTestResult;
    }
    return TestAccountConnectionPreview(payload);
  },
  updateAccount: async (accountId: string, input: AccountFormInput) => {
    const useBridge = isDesktopMode();
    set({ loading: true, error: undefined });
    try {
      let updated: AccountModel | null = null;
      const existing = get().accounts.find((account) => account.id === accountId);
      if (useBridge) {
        const payload: Record<string, unknown> = {
          provider: input.provider,
          name: input.name,
          endpoint: input.endpoint,
          region: input.region,
          port: input.port,
          useSSL: input.useSSL,
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
        const serverAccount = await UpdateAccount(accountId, payload);
        updated = normalizeAccount(serverAccount);
      } else if (existing) {
        const providerLabel =
          get().providers.find((item) => item.id === input.provider)?.label ?? input.provider;
        updated = {
          id: accountId,
          name: input.name,
          tag: input.tag ?? existing.tag,
          provider: input.provider,
          providerLabel,
          endpoint: input.endpoint,
          region: input.region,
          useSSL: input.useSSL,
          port: input.port,
          accessKeyPreview: input.accessKeyId
            ? maskAccessKey(input.accessKeyId)
            : existing.accessKeyPreview,
          hasSecret: Boolean(input.secretAccessKey || existing.hasSecret),
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        };
      }
      if (!updated) throw new Error("更新账户失败");
      set((state) => ({
        accounts: state.accounts.map((account) =>
          account.id === accountId ? { ...account, ...updated! } : account,
        ),
        loading: false,
        error: undefined,
      }));
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新账户失败";
      set({ loading: false, error: message });
      throw error;
    }
  },
  deleteAccount: async (accountId: string) => {
    const useBridge = isDesktopMode();
    set({ loading: true, error: undefined });
    try {
      if (useBridge) {
        await DeleteAccount(accountId);
      }
      set((state) => {
        const remaining = state.accounts.filter((account) => account.id !== accountId);
        const nextActive =
          state.activeAccountId === accountId
            ? (remaining[0]?.id ?? null)
            : (state.activeAccountId ?? null);
        const { [accountId]: _removed, ...rest } = state.connectionTests;
        return {
          accounts: remaining,
          activeAccountId: nextActive,
          loading: false,
          connectionTests: rest,
        };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除账户失败";
      set({ loading: false, error: message });
      throw error;
    }
  },
  exportAccounts: async () => {
    const result = await accountService.exportAccounts();
    if (result.success) {
      set({ error: undefined });
      return result.data;
    } else {
      set({ error: result.error });
      throw new Error(result.error);
    }
  },
  importAccounts: async () => {
    const result = await accountService.importAccounts();
    if (result.success) {
      if (!result.data.cancelled) {
        await get().refresh();
      }
      set({ error: undefined });
      return result.data;
    } else {
      set({ error: result.error });
      throw new Error(result.error);
    }
  },
}));

export const useAccountsStore: typeof useAccountsStoreBase = useAccountsStoreBase;

const relay = <Args extends unknown[], Return>(
  selector: (store: AccountsStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useAccountsStoreBase.getState())(...args);
};

export const accountsStore = {
  bootstrap: relay((store) => store.bootstrap),
  refresh: relay((store) => store.refresh),
  setActiveAccount: relay((store) => store.setActiveAccount),
  createAccount: relay((store) => store.createAccount),
  testConnection: relay((store) => store.testConnection),
  testConnectionPreview: relay((store) => store.testConnectionPreview),
  updateAccount: relay((store) => store.updateAccount),
  deleteAccount: relay((store) => store.deleteAccount),
  exportAccounts: relay((store) => store.exportAccounts),
  importAccounts: relay((store) => store.importAccounts),
  getState: () => useAccountsStoreBase.getState(),
};
