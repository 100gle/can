import { create } from "zustand";
import {
  DeleteBucketCORS,
  DeleteBucketEncryption,
  DeleteBucketLifecycle,
  EnableBucketVersioning,
  GetBucketCORS,
  GetBucketEncryption,
  GetBucketLifecycle,
  GetBucketVersioning,
  SetBucketCORS,
  SetBucketEncryption,
  SetBucketLifecycle,
  SuspendBucketVersioning,
} from "../../wailsjs/go/main/App";
import type { config as ConfigModels } from "../../wailsjs/go/models";
import { isBridgeAvailable } from "@/lib/bridge";

export type BucketVersioningModel = {
  status?: string;
  updated?: any;
};

export type BucketEncryptionModel = {
  enabled: boolean;
  algorithm: string;
  kmsKeyId?: string;
  updated?: any;
};

export type LifecycleRuleModel = {
  id: string;
  prefix: string;
  status: string;
  expirationDays: number;
  transitionDays: number;
  noncurrentDays: number;
};

export type BucketCORSModel = {
  rules: Array<{
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    exposeHeaders: string[];
    maxAgeSeconds: number;
  }>;
};

type SavingKey = "versioning" | "encryption" | "lifecycle" | "cors";

export type BucketConfigState = {
  accountId?: string;
  bucket?: string;
  versioning?: BucketVersioningModel;
  encryption?: BucketEncryptionModel;
  lifecycle: LifecycleRuleModel[];
  cors?: BucketCORSModel;
  loading: boolean;
  saving: Partial<Record<SavingKey, boolean>>;
  error?: string;
};

export type BucketConfigActions = {
  loadConfig: (accountId: string, bucket: string) => Promise<void>;
  refresh: () => Promise<void>;
  saveVersioning: (status: "Enabled" | "Suspended") => Promise<void>;
  saveEncryption: (payload: BucketEncryptionModel) => Promise<void>;
  saveLifecycle: (rules: LifecycleRuleModel[]) => Promise<void>;
  saveCORS: (cors: BucketCORSModel) => Promise<void>;
};

type BucketConfigStore = BucketConfigState & BucketConfigActions;

const createInitialState = (): BucketConfigState => ({
  lifecycle: [],
  loading: false,
  saving: {},
});

const FALLBACK_VERSIONING: BucketVersioningModel = {
  status: "Suspended",
  updated: new Date().toISOString() as any,
};

const FALLBACK_ENCRYPTION: BucketEncryptionModel = {
  enabled: false,
  algorithm: "",
  kmsKeyId: "",
  updated: new Date().toISOString() as any,
};

const FALLBACK_CORS: BucketCORSModel = {
  rules: [
    {
      allowedOrigins: ["*"],
      allowedMethods: ["GET", "HEAD"],
      allowedHeaders: ["*"],
      exposeHeaders: [],
      maxAgeSeconds: 300,
    },
  ],
};

const clone = <T>(input: T): T => {
  try {
    return JSON.parse(JSON.stringify(input));
  } catch {
    return input;
  }
};

const normalizeVersioning = (
  versioning?: ConfigModels.BucketVersioning | null,
): BucketVersioningModel | undefined => {
  if (!versioning) return undefined;
  return clone({
    status: versioning.status,
    updated: versioning.updated,
  });
};

const normalizeEncryption = (
  encryption?: ConfigModels.BucketEncryption | null,
): BucketEncryptionModel | undefined => {
  if (!encryption) return undefined;
  return clone({
    enabled: Boolean(encryption.enabled),
    algorithm: encryption.algorithm || "",
    kmsKeyId: encryption.kmsKeyId || "",
    updated: encryption.updated,
  });
};

const normalizeLifecycle = (
  rules: ConfigModels.LifecycleRule[] | undefined,
): LifecycleRuleModel[] => {
  if (!rules?.length) return [];
  return rules.map((rule) => ({
    id: rule.id || "",
    prefix: rule.prefix || "",
    status: rule.status || "Enabled",
    expirationDays: rule.expirationDays || 0,
    transitionDays: rule.transitionDays || 0,
    noncurrentDays: rule.noncurrentDays || 0,
  }));
};

const normalizeCORS = (cors: ConfigModels.BucketCORS | undefined): BucketCORSModel | undefined => {
  if (!cors) return undefined;
  return {
    rules:
      cors.rules?.map((rule) => ({
        allowedOrigins: [...(rule.allowedOrigins ?? [])],
        allowedMethods: [...(rule.allowedMethods ?? [])],
        allowedHeaders: [...(rule.allowedHeaders ?? [])],
        exposeHeaders: [...(rule.exposeHeaders ?? [])],
        maxAgeSeconds: rule.maxAgeSeconds ?? 300,
      })) ?? [],
  };
};

const useBucketConfigStoreBase = create<BucketConfigStore>((set, get) => ({
  ...createInitialState(),
  loadConfig: async (accountId: string, bucket: string) => {
    if (!accountId || !bucket) {
      set({ ...createInitialState() });
      return;
    }
    set({
      loading: true,
      error: undefined,
      accountId,
      bucket,
    });
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        const [versioning, encryption, lifecycle, cors] = await Promise.all([
          GetBucketVersioning(accountId, bucket),
          GetBucketEncryption(accountId, bucket),
          GetBucketLifecycle(accountId, bucket),
          GetBucketCORS(accountId, bucket),
        ]);
        set({
          versioning: normalizeVersioning(versioning as ConfigModels.BucketVersioning),
          encryption: normalizeEncryption(encryption as ConfigModels.BucketEncryption),
          lifecycle: normalizeLifecycle(lifecycle as ConfigModels.LifecycleRule[]),
          cors: normalizeCORS(cors as ConfigModels.BucketCORS),
          loading: false,
        });
      } else {
        set({
          versioning: { ...FALLBACK_VERSIONING },
          encryption: { ...FALLBACK_ENCRYPTION },
          lifecycle: [],
          cors: { ...FALLBACK_CORS },
          loading: false,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载配置失败";
      set({ loading: false, error: message });
      throw error;
    }
  },
  refresh: async () => {
    const { accountId, bucket } = get();
    if (accountId && bucket) {
      await get().loadConfig(accountId, bucket);
    }
  },
  saveVersioning: async (status: "Enabled" | "Suspended") => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, versioning: true }, error: undefined }));
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        if (status === "Enabled") {
          await EnableBucketVersioning(accountId, bucket);
        } else {
          await SuspendBucketVersioning(accountId, bucket);
        }
        set({
          versioning: {
            status,
            updated: new Date().toISOString() as any,
          },
        });
      } else {
        set({
          versioning: {
            status,
            updated: new Date().toISOString() as any,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存版本控制失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => {
        const { versioning, ...rest } = state.saving;
        return { saving: rest };
      });
    }
  },
  saveEncryption: async (payload: BucketEncryptionModel) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, encryption: true }, error: undefined }));
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        if (!payload.enabled) {
          await DeleteBucketEncryption(accountId, bucket);
        } else {
          await SetBucketEncryption(accountId, bucket, payload as any);
        }
      }
      set({
        encryption: {
          ...payload,
          updated: new Date().toISOString() as any,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存加密配置失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => {
        const { encryption, ...rest } = state.saving;
        return { saving: rest };
      });
    }
  },
  saveLifecycle: async (rules: LifecycleRuleModel[]) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, lifecycle: true }, error: undefined }));
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        if (rules.length === 0) {
          await DeleteBucketLifecycle(accountId, bucket);
        } else {
          await SetBucketLifecycle(accountId, bucket, rules as any);
        }
      }
      set({ lifecycle: rules });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存生命周期失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => {
        const { lifecycle, ...rest } = state.saving;
        return { saving: rest };
      });
    }
  },
  saveCORS: async (cors: BucketCORSModel) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, cors: true }, error: undefined }));
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        if (!cors.rules?.length) {
          await DeleteBucketCORS(accountId, bucket);
        } else {
          await SetBucketCORS(accountId, bucket, cors as any);
        }
      }
      set({ cors });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存 CORS 失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => {
        const { cors, ...rest } = state.saving;
        return { saving: rest };
      });
    }
  },
}));

export const useBucketConfigStore = <T>(selector: (state: BucketConfigState) => T): T =>
  useBucketConfigStoreBase(selector as (state: BucketConfigStore) => T);

const relay = <Args extends unknown[], Return>(
  selector: (store: BucketConfigStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useBucketConfigStoreBase.getState())(...args);
};

export const bucketConfigStore = {
  loadConfig: relay((store) => store.loadConfig),
  refresh: relay((store) => store.refresh),
  saveVersioning: relay((store) => store.saveVersioning),
  saveEncryption: relay((store) => store.saveEncryption),
  saveLifecycle: relay((store) => store.saveLifecycle),
  saveCORS: relay((store) => store.saveCORS),
};
