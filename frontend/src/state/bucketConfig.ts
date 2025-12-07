import { isBridgeAvailable } from "@/lib/bridge";
import type { ProviderCapability } from "@/state/accounts";
import {
  DeleteBucketCORS,
  DeleteBucketEncryption,
  DeleteBucketLifecycle,
  DeleteBucketPolicy,
  EnableBucketVersioning,
  GetBucketACL,
  GetBucketCORS,
  GetBucketEncryption,
  GetBucketLifecycle,
  GetBucketPolicy,
  GetBucketReferer,
  GetBucketVersioning,
  GetPublicAccessBlock,
  SetBucketACL,
  SetBucketCORS,
  SetBucketEncryption,
  SetBucketLifecycle,
  SetBucketPolicy,
  SetBucketReferer,
  SetPublicAccessBlock,
  SuspendBucketVersioning,
} from "@wailsjs/go/app/App";
import type { config as ConfigModels } from "@wailsjs/go/models";
import { create } from "zustand";

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

export type ACLGrantModel = {
  granteeType: string;
  grantee: string;
  permission: string;
  displayName?: string;
  uri?: string;
};

export type BucketACLModel = {
  ownerId: string;
  ownerDisplayName?: string;
  canned?: string;
  grants: ACLGrantModel[];
  updated?: any;
};

export type PublicAccessBlockModel = {
  blockPublicAcls: boolean;
  ignorePublicAcls: boolean;
  blockPublicPolicy: boolean;
  restrictPublicBuckets: boolean;
  updated?: any;
};

export type BucketRefererModel = {
  enabled: boolean;
  allowEmpty: boolean;
  whitelist: string[];
  mode?: string;
  updated?: any;
};

type SavingKey =
  | "versioning"
  | "encryption"
  | "lifecycle"
  | "cors"
  | "policy"
  | "acl"
  | "publicAccess"
  | "referer";

export type BucketFeature =
  | "versioning"
  | "encryption"
  | "lifecycle"
  | "cors"
  | "website"
  | "policy"
  | "acl"
  | "publicAccess"
  | "referer";

export type BucketConfigState = {
  accountId?: string;
  bucket?: string;
  versioning?: BucketVersioningModel;
  encryption?: BucketEncryptionModel;
  lifecycle: LifecycleRuleModel[];
  cors?: BucketCORSModel;
  policy?: { raw: string; version: string; statement: any[] };
  acl?: BucketACLModel;
  publicAccessBlock?: PublicAccessBlockModel;
  referer?: BucketRefererModel;
  loading: boolean;
  saving: Partial<Record<SavingKey, boolean>>;
  error?: string;
  featureSupport: Partial<Record<BucketFeature, ProviderCapability>>;
};

export type BucketConfigActions = {
  loadConfig: (
    accountId: string,
    bucket: string,
    features?: Partial<Record<BucketFeature, ProviderCapability>>,
  ) => Promise<void>;
  refresh: () => Promise<void>;
  saveVersioning: (status: "Enabled" | "Suspended") => Promise<void>;
  saveEncryption: (payload: BucketEncryptionModel) => Promise<void>;
  saveLifecycle: (rules: LifecycleRuleModel[]) => Promise<void>;
  saveCORS: (cors: BucketCORSModel) => Promise<void>;
  setPolicy: (json: string) => Promise<void>;
  deletePolicy: () => Promise<void>;
  saveBucketACL: (acl: BucketACLModel) => Promise<void>;
  savePublicAccessBlock: (payload: PublicAccessBlockModel) => Promise<void>;
  saveReferer: (payload: BucketRefererModel) => Promise<void>;
};

type BucketConfigStore = BucketConfigState & BucketConfigActions;

const createInitialState = (): BucketConfigState => ({
  lifecycle: [],
  loading: false,
  saving: {},
  featureSupport: {},
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

const EMPTY_ACL: BucketACLModel = {
  ownerId: "",
  ownerDisplayName: "",
  canned: "private",
  grants: [],
  updated: new Date().toISOString() as any,
};

const FALLBACK_PUBLIC_ACCESS: PublicAccessBlockModel = {
  blockPublicAcls: true,
  ignorePublicAcls: true,
  blockPublicPolicy: true,
  restrictPublicBuckets: true,
  updated: new Date().toISOString() as any,
};

const FALLBACK_REFERER: BucketRefererModel = {
  enabled: false,
  allowEmpty: true,
  whitelist: [],
  mode: "white-list",
  updated: new Date().toISOString() as any,
};

const supportsFeature = (capability?: ProviderCapability): boolean => {
  if (!capability) return true;
  return capability.supported !== false;
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

const normalizeACL = (acl: ConfigModels.BucketACL | undefined | null): BucketACLModel | undefined => {
  if (!acl) return undefined;
  return clone({
    ownerId: acl.ownerId || "",
    ownerDisplayName: acl.ownerDisplayName || "",
    canned: acl.canned || "",
    grants: acl.grants?.map((grant) => ({ ...grant })) ?? [],
    updated: acl.updated,
  });
};

const normalizePublicAccessBlock = (
  block: ConfigModels.PublicAccessBlock | undefined | null,
): PublicAccessBlockModel | undefined => {
  if (!block) return undefined;
  return clone({
    blockPublicAcls: Boolean(block.blockPublicAcls),
    ignorePublicAcls: Boolean(block.ignorePublicAcls),
    blockPublicPolicy: Boolean(block.blockPublicPolicy),
    restrictPublicBuckets: Boolean(block.restrictPublicBuckets),
    updated: block.updated,
  });
};

const normalizeReferer = (
  referer: ConfigModels.BucketReferer | undefined | null,
): BucketRefererModel | undefined => {
  if (!referer) return undefined;
  return clone({
    enabled: Boolean(referer.enabled),
    allowEmpty: Boolean(referer.allowEmpty),
    whitelist: [...(referer.whitelist ?? [])],
    mode: referer.mode || "white-list",
    updated: referer.updated,
  });
};

const useBucketConfigStoreBase = create<BucketConfigStore>((set, get) => ({
  ...createInitialState(),
  loadConfig: async (
    accountId: string,
    bucket: string,
    features?: Partial<Record<BucketFeature, ProviderCapability>>,
  ) => {
    if (!accountId || !bucket) {
      set({ ...createInitialState() });
      return;
    }
    const featureSupport = features ?? {};
    const canVersioning = supportsFeature(featureSupport.versioning);
    const canEncryption = supportsFeature(featureSupport.encryption);
    const canLifecycle = supportsFeature(featureSupport.lifecycle);
    const canCORS = supportsFeature(featureSupport.cors);
    const canPolicy = supportsFeature(featureSupport.policy);
    const canACL = supportsFeature(featureSupport.acl);
    const canPublicAccess = supportsFeature(featureSupport.publicAccess);
    const canReferer = supportsFeature(featureSupport.referer);

    set({
      loading: true,
      error: undefined,
      accountId,
      bucket,
      featureSupport,
    });

    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        const [
          versioning,
          encryption,
          lifecycle,
          cors,
          policy,
          acl,
          publicAccess,
          referer,
        ] = await Promise.all([
          canVersioning
            ? GetBucketVersioning(accountId, bucket)
            : Promise.resolve(undefined as ConfigModels.BucketVersioning | undefined),
          canEncryption
            ? GetBucketEncryption(accountId, bucket)
            : Promise.resolve(undefined as ConfigModels.BucketEncryption | undefined),
          canLifecycle
            ? GetBucketLifecycle(accountId, bucket)
            : Promise.resolve(undefined as ConfigModels.LifecycleRule[] | undefined),
          canCORS
            ? GetBucketCORS(accountId, bucket)
            : Promise.resolve(undefined as ConfigModels.BucketCORS | undefined),
          canPolicy
            ? GetBucketPolicy(accountId, bucket)
            : Promise.resolve(undefined as ConfigModels.BucketPolicy | undefined),
          canACL
            ? GetBucketACL(accountId, bucket)
            : Promise.resolve(undefined as ConfigModels.BucketACL | undefined),
          canPublicAccess
            ? GetPublicAccessBlock(accountId, bucket)
            : Promise.resolve(undefined as ConfigModels.PublicAccessBlock | undefined),
          canReferer
            ? GetBucketReferer(accountId, bucket)
            : Promise.resolve(undefined as ConfigModels.BucketReferer | undefined),
        ]);
        set({
          versioning: canVersioning
            ? normalizeVersioning(versioning as ConfigModels.BucketVersioning)
            : undefined,
          encryption: canEncryption
            ? normalizeEncryption(encryption as ConfigModels.BucketEncryption)
            : undefined,
          lifecycle: canLifecycle
            ? normalizeLifecycle(lifecycle as ConfigModels.LifecycleRule[])
            : [],
          cors: canCORS ? normalizeCORS(cors as ConfigModels.BucketCORS) : undefined,
          policy:
            canPolicy && policy
              ? { raw: policy.raw, version: policy.version, statement: policy.statement }
              : undefined,
          acl: canACL ? normalizeACL(acl as ConfigModels.BucketACL) : undefined,
          publicAccessBlock: canPublicAccess
            ? normalizePublicAccessBlock(publicAccess as ConfigModels.PublicAccessBlock)
            : undefined,
          referer: canReferer ? normalizeReferer(referer as ConfigModels.BucketReferer) : undefined,
          loading: false,
        });
      } else {
        set({
          versioning: canVersioning ? { ...FALLBACK_VERSIONING } : undefined,
          encryption: canEncryption ? { ...FALLBACK_ENCRYPTION } : undefined,
          lifecycle: canLifecycle ? [] : [],
          cors: canCORS ? { ...FALLBACK_CORS } : undefined,
          policy: canPolicy ? { raw: "", version: "", statement: [] } : undefined,
          acl: canACL ? { ...EMPTY_ACL } : undefined,
          publicAccessBlock: canPublicAccess ? { ...FALLBACK_PUBLIC_ACCESS } : undefined,
          referer: canReferer ? { ...FALLBACK_REFERER } : undefined,
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
    const { accountId, bucket, featureSupport } = get();
    if (accountId && bucket) {
      await get().loadConfig(accountId, bucket, featureSupport);
    }
  },
  // ... existing save methods ...
  saveVersioning: async (status: "Enabled" | "Suspended") => {
    // ... existing implementation simplified for brevity ...
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, versioning: true }, error: undefined }));
    try {
      if (status === "Enabled") await EnableBucketVersioning(accountId, bucket);
      else await SuspendBucketVersioning(accountId, bucket);
      set({ versioning: { status, updated: new Date().toISOString() as any } });
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存版本控制失败";
      set({ error: message });
      throw e;
    } finally {
      set((s) => ({ saving: { ...s.saving, versioning: false } }));
    }
  },
  saveEncryption: async (payload: BucketEncryptionModel) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, encryption: true }, error: undefined }));
    try {
      if (!payload.enabled) await DeleteBucketEncryption(accountId, bucket);
      else await SetBucketEncryption(accountId, bucket, payload as any);
      set({ encryption: { ...payload, updated: new Date().toISOString() as any } });
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存加密配置失败";
      set({ error: message });
      throw e;
    } finally {
      set((s) => ({ saving: { ...s.saving, encryption: false } }));
    }
  },
  saveLifecycle: async (rules: LifecycleRuleModel[]) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, lifecycle: true }, error: undefined }));
    try {
      if (!rules.length) await DeleteBucketLifecycle(accountId, bucket);
      else await SetBucketLifecycle(accountId, bucket, rules as any);
      set({ lifecycle: rules });
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存生命周期失败";
      set({ error: message });
      throw e;
    } finally {
      set((s) => ({ saving: { ...s.saving, lifecycle: false } }));
    }
  },
  saveCORS: async (cors: BucketCORSModel) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, cors: true }, error: undefined }));
    try {
      if (!cors.rules?.length) await DeleteBucketCORS(accountId, bucket);
      else await SetBucketCORS(accountId, bucket, cors as any);
      set({ cors });
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存 CORS 失败";
      set({ error: message });
      throw e;
    } finally {
      set((s) => ({ saving: { ...s.saving, cors: false } }));
    }
  },
  setPolicy: async (json: string) => {
    const { accountId, bucket, featureSupport } = get();
    if (!accountId || !bucket) return;
    const capability = featureSupport.policy;
    if (capability && capability.supported === false) {
      set({ error: capability.message || "当前供应商不支持策略配置" });
      return;
    }
    set((state) => ({ saving: { ...state.saving, policy: true }, error: undefined }));
    try {
      // Parse JSON to validate and structure if needed, or send raw
      // The backend SetBucketPolicy expects a struct.
      // If we only have raw JSON string, we might need to parse it to fill the struct fields
      // OR update backend to accept raw string.
      // Looking at backend config/policy.go, it uses BucketPolicy struct.
      // Let's try to parse it.
      let policyStruct: ConfigModels.BucketPolicy;
      try {
        const parsed = JSON.parse(json);
        policyStruct = {
          raw: json,
          version: parsed.Version || "",
          statement: parsed.Statement || [],
        } as any;
      } catch {
        throw new Error("Invalid JSON format");
      }

      const useBridge = isBridgeAvailable();
      if (useBridge) {
        await SetBucketPolicy(accountId, bucket, policyStruct);
      }
      set({
        policy: { raw: json, version: policyStruct.version, statement: policyStruct.statement },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存策略失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => {
        const { policy: _policy, ...rest } = state.saving;
        return { saving: rest };
      });
    }
  },
  deletePolicy: async () => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, policy: true }, error: undefined }));
    try {
      const useBridge = isBridgeAvailable();
      if (useBridge) {
        await DeleteBucketPolicy(accountId, bucket);
      }
      set({ policy: undefined });
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除策略失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => {
        const { policy: _policy, ...rest } = state.saving;
        return { saving: rest };
      });
    }
  },
  saveBucketACL: async (payload: BucketACLModel) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, acl: true }, error: undefined }));
    try {
      if (isBridgeAvailable()) {
        await SetBucketACL(accountId, bucket, payload as any);
      }
      set({ acl: { ...payload, updated: new Date().toISOString() as any } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存 ACL 失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => ({ saving: { ...state.saving, acl: false } }));
    }
  },
  savePublicAccessBlock: async (payload: PublicAccessBlockModel) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, publicAccess: true }, error: undefined }));
    try {
      if (isBridgeAvailable()) {
        await SetPublicAccessBlock(accountId, bucket, payload as any);
      }
      set({ publicAccessBlock: { ...payload, updated: new Date().toISOString() as any } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存阻止公共访问失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => ({ saving: { ...state.saving, publicAccess: false } }));
    }
  },
  saveReferer: async (payload: BucketRefererModel) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) return;
    set((state) => ({ saving: { ...state.saving, referer: true }, error: undefined }));
    try {
      if (isBridgeAvailable()) {
        await SetBucketReferer(accountId, bucket, payload as any);
      }
      set({ referer: { ...payload, updated: new Date().toISOString() as any } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "保存防盗链配置失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => ({ saving: { ...state.saving, referer: false } }));
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
  setPolicy: relay((store) => store.setPolicy),
  deletePolicy: relay((store) => store.deletePolicy),
  saveBucketACL: relay((store) => store.saveBucketACL),
  savePublicAccessBlock: relay((store) => store.savePublicAccessBlock),
  saveReferer: relay((store) => store.saveReferer),
};
