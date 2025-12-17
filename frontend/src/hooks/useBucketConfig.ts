import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  GetBucketWebsite,
  GetPublicAccessBlock,
  SetBucketACL,
  SetBucketCORS,
  SetBucketEncryption,
  SetBucketLifecycle,
  SetBucketPolicy,
  SetBucketReferer,
  SetBucketWebsite,
  SetPublicAccessBlock,
  SuspendBucketVersioning,
} from "@wailsjs/go/app/App";
import type { config as ConfigModels, storage as StorageModels } from "@wailsjs/go/models";

// Re-using types from existing state or defining them here if we want to decouple completely.
// Ideally, we move types to a shared location, but for now let's import or redefine.
// Since we are refactoring state/bucketConfig.ts, we will eventually strip it.
// Let's copy the types and normalization logic here to be self-contained in the data layer.

// --- Types ---
export type BucketFeature =
  | "versioning"
  | "encryption"
  | "lifecycle"
  | "cors"
  | "policy"
  | "acl"
  | "publicAccess"
  | "referer"
  | "website";
export type BucketVersioningModel = { status?: string; updated?: string };
export type BucketEncryptionModel = {
  enabled: boolean;
  algorithm: string;
  kmsKeyId?: string;
  updated?: string;
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
export type BucketACLModel = {
  ownerId: string;
  ownerDisplayName?: string;
  canned?: string;
  grants: any[];
  updated?: string;
};
export type PublicAccessBlockModel = {
  blockPublicAcls: boolean;
  ignorePublicAcls: boolean;
  blockPublicPolicy: boolean;
  restrictPublicBuckets: boolean;
  updated?: string;
};
export type BucketRefererModel = {
  enabled: boolean;
  allowEmpty: boolean;
  whitelist: string[];
  mode?: string;
  updated?: string;
};
export type BucketPolicyModel = { raw: string; version: string; statement: any[] };
export type BucketWebsiteModel = {
  enabled: boolean;
  indexKey: string;
  errorKey: string;
  updated?: string;
};

// --- Normalizers ---
const clone = <T>(input: T): T => JSON.parse(JSON.stringify(input));

const normalizeVersioning = (
  v?: StorageModels.BucketVersioningConfiguration | null,
): BucketVersioningModel | undefined => {
  if (!v) return undefined;
  return { status: v.Status, updated: new Date().toISOString() };
};
const normalizeEncryption = (
  e?: ConfigModels.BucketEncryption | null,
): BucketEncryptionModel | undefined => {
  if (!e) return undefined;
  return {
    enabled: Boolean(e.enabled),
    algorithm: e.algorithm || "",
    kmsKeyId: e.kmsKeyId || "",
    updated: new Date().toISOString(),
  };
};
const normalizeLifecycle = (rules?: ConfigModels.LifecycleRule[]): LifecycleRuleModel[] => {
  if (!rules?.length) return [];
  return rules.map((r) => ({
    id: r.id || "",
    prefix: r.prefix || "",
    status: r.status || "Enabled",
    expirationDays: r.expirationDays || 0,
    transitionDays: r.transitionDays || 0,
    noncurrentDays: r.noncurrentDays || 0,
  }));
};
const normalizeCORS = (c?: ConfigModels.BucketCORS): BucketCORSModel | undefined => {
  if (!c) return undefined;
  return {
    rules:
      c.rules?.map((r) => ({
        allowedOrigins: [...(r.AllowedOrigins || [])],
        allowedMethods: [...(r.AllowedMethods || [])],
        allowedHeaders: [...(r.AllowedHeaders || [])],
        exposeHeaders: [...(r.ExposeHeaders || [])],
        maxAgeSeconds: r.MaxAgeSeconds ?? 300,
      })) ?? [],
  };
};
const normalizeACL = (a?: StorageModels.BucketACL | null): BucketACLModel | undefined => {
  if (!a) return undefined;
  return {
    ownerId: a.ownerId || "",
    ownerDisplayName: a.ownerDisplayName || "",
    canned: a.canned || "",
    grants: clone(a.grants || []),
    updated: new Date().toISOString(),
  };
};
const normalizePublicAccess = (
  b?: StorageModels.PublicAccessBlock | null,
): PublicAccessBlockModel | undefined => {
  if (!b) return undefined;
  return {
    blockPublicAcls: Boolean(b.blockPublicAcls),
    ignorePublicAcls: Boolean(b.ignorePublicAcls),
    blockPublicPolicy: Boolean(b.blockPublicPolicy),
    restrictPublicBuckets: Boolean(b.restrictPublicBuckets),
    updated: new Date().toISOString(),
  };
};
const normalizeReferer = (
  r?: StorageModels.BucketReferer | null,
): BucketRefererModel | undefined => {
  if (!r) return undefined;
  return {
    enabled: Boolean(r.enabled),
    allowEmpty: Boolean(r.allowEmpty),
    whitelist: [...(r.whitelist || [])],
    mode: r.mode || "white-list",
    updated: new Date().toISOString(),
  };
};
const normalizeWebsite = (
  w?: ConfigModels.BucketWebsite | null,
): BucketWebsiteModel | undefined => {
  if (!w) return undefined;
  return {
    enabled: Boolean(w.enabled),
    indexKey: w.indexKey || "",
    errorKey: w.errorKey || "",
    updated: new Date().toISOString(),
  };
};

// --- Hooks ---

const key = (accountId: string, bucket: string, feature: string) =>
  ["bucket-config", accountId, bucket, feature] as const;

export const useBucketVersioning = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "versioning"),
    queryFn: async (): Promise<BucketVersioningModel | undefined> => {
      const res = await GetBucketVersioning(accountId, bucket);
      return normalizeVersioning(res as any);
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdateVersioning = () => {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { accountId: string; bucket: string; status: "Enabled" | "Suspended" }
  >({
    mutationFn: async ({ accountId, bucket, status }) => {
      if (status === "Enabled") await EnableBucketVersioning(accountId, bucket);
      else await SuspendBucketVersioning(accountId, bucket);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "versioning") }),
  });
};

export const useBucketEncryption = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "encryption"),
    queryFn: async (): Promise<BucketEncryptionModel | undefined> => {
      const res = await GetBucketEncryption(accountId, bucket);
      return normalizeEncryption(res as any);
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdateEncryption = () => {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { accountId: string; bucket: string; config: BucketEncryptionModel }
  >({
    mutationFn: async ({ accountId, bucket, config }) => {
      if (!config.enabled) await DeleteBucketEncryption(accountId, bucket);
      else await SetBucketEncryption(accountId, bucket, config as any);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "encryption") }),
  });
};

export const useBucketLifecycle = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "lifecycle"),
    queryFn: async (): Promise<LifecycleRuleModel[]> => {
      const res = await GetBucketLifecycle(accountId, bucket);
      return normalizeLifecycle(res as any);
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdateLifecycle = () => {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { accountId: string; bucket: string; rules: LifecycleRuleModel[] }
  >({
    mutationFn: async ({ accountId, bucket, rules }) => {
      if (rules.length === 0) await DeleteBucketLifecycle(accountId, bucket);
      else await SetBucketLifecycle(accountId, bucket, rules as any);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "lifecycle") }),
  });
};

export const useBucketCORS = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "cors"),
    queryFn: async (): Promise<BucketCORSModel | undefined> => {
      const res = await GetBucketCORS(accountId, bucket);
      return normalizeCORS(res as any);
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdateCORS = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, { accountId: string; bucket: string; config: BucketCORSModel }>({
    mutationFn: async ({ accountId, bucket, config }) => {
      if ((config.rules?.length ?? 0) === 0) await DeleteBucketCORS(accountId, bucket);
      else await SetBucketCORS(accountId, bucket, config as any);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "cors") }),
  });
};

export const useBucketPolicy = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "policy"),
    queryFn: async (): Promise<BucketPolicyModel | undefined> => {
      const res = await GetBucketPolicy(accountId, bucket);
      if (!res) return undefined;
      return { raw: res.raw, version: res.version, statement: res.statement };
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdatePolicy = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, { accountId: string; bucket: string; json: string }>({
    mutationFn: async ({ accountId, bucket, json }) => {
      // Validate JSON
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
      await SetBucketPolicy(accountId, bucket, policyStruct);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "policy") }),
  });
};

export const useDeletePolicy = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, { accountId: string; bucket: string }>({
    mutationFn: async ({ accountId, bucket }) => {
      await DeleteBucketPolicy(accountId, bucket);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "policy") }),
  });
};

export const useBucketACL = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "acl"),
    queryFn: async (): Promise<BucketACLModel | undefined> => {
      const res = await GetBucketACL(accountId, bucket);
      return normalizeACL(res as any);
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdateACL = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, { accountId: string; bucket: string; acl: BucketACLModel }>({
    mutationFn: async ({ accountId, bucket, acl }) => {
      await SetBucketACL(accountId, bucket, acl as any);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "acl") }),
  });
};

export const usePublicAccessBlock = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "publicAccess"),
    queryFn: async (): Promise<PublicAccessBlockModel | undefined> => {
      const res = await GetPublicAccessBlock(accountId, bucket);
      return normalizePublicAccess(res as any);
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdatePublicAccessBlock = () => {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { accountId: string; bucket: string; block: PublicAccessBlockModel }
  >({
    mutationFn: async ({ accountId, bucket, block }) => {
      await SetPublicAccessBlock(accountId, bucket, block as any);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "publicAccess") }),
  });
};

export const useBucketReferer = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "referer"),
    queryFn: async (): Promise<BucketRefererModel | undefined> => {
      const res = await GetBucketReferer(accountId, bucket);
      return normalizeReferer(res as any);
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdateReferer = () => {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { accountId: string; bucket: string; config: BucketRefererModel }
  >({
    mutationFn: async ({ accountId, bucket, config }) => {
      await SetBucketReferer(accountId, bucket, config as any);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "referer") }),
  });
};

export const useBucketWebsite = (accountId: string, bucket: string, enabled = true) =>
  useQuery({
    queryKey: key(accountId, bucket, "website"),
    queryFn: async (): Promise<BucketWebsiteModel | undefined> => {
      const res = await GetBucketWebsite(accountId, bucket);
      return normalizeWebsite(res as any);
    },
    enabled: enabled && !!accountId && !!bucket,
  });

export const useUpdateWebsite = () => {
  const qc = useQueryClient();
  return useMutation<
    void,
    Error,
    { accountId: string; bucket: string; config: BucketWebsiteModel }
  >({
    mutationFn: async ({ accountId, bucket, config }) => {
      await SetBucketWebsite(accountId, bucket, config as any);
    },
    onSuccess: (_data: void, { accountId, bucket }: { accountId: string; bucket: string }) =>
      qc.invalidateQueries({ queryKey: key(accountId, bucket, "website") }),
  });
};
