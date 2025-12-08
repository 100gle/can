import { isBridgeAvailable } from "@/lib/bridge";
import { offlineManager } from "@/lib/offline";
import { usePreferencesStore } from "@/state/preferences";
import { CreateBucket, DeleteBucket, ListBuckets } from "@wailsjs/go/app/App";
import type { buckets as BucketModels } from "@wailsjs/go/models";
import { create } from "zustand";

export type BucketModel = BucketModels.BucketInfo;
export type BucketCreateInput = BucketModels.CreateBucketInput;

export type BucketsState = {
  accountId?: string;
  buckets: BucketModel[];
  selectedBucket?: string;
  loading: boolean;
  creating: boolean;
  deleting: Record<string, boolean>;
  error?: string;
  isFromCache: boolean;
  lastSync?: number;
};

export type BucketsActions = {
  loadBuckets: (accountId: string) => Promise<void>;
  refresh: () => Promise<void>;
  createBucket: (accountId: string, input: BucketCreateInput) => Promise<void>;
  deleteBucket: (accountId: string, name: string) => Promise<void>;
  selectBucket: (name: string) => void;
  reset: () => void;
};

type BucketsStore = BucketsState & BucketsActions;

const createInitialState = (): BucketsState => ({
  buckets: [],
  loading: false,
  creating: false,
  deleting: {},
  error: undefined,
  isFromCache: false,
});

const FALLBACK_BUCKETS: BucketModel[] = [
  {
    name: "product-assets",
    region: "us-east-1",
    objectCount: 0,
    size: 0,
    createdAt: new Date().toISOString() as any,
  },
  {
    name: "logs-r2",
    region: "auto",
    objectCount: 0,
    size: 0,
    createdAt: new Date().toISOString() as any,
  },
];

const normalizeBucket = (bucket: BucketModels.BucketInfo | BucketModel): BucketModel => ({
  ...(bucket as BucketModel),
});

const useBucketsStoreBase = create<BucketsStore>((set, get) => ({
  ...createInitialState(),
  loadBuckets: async (accountId: string) => {
    if (!accountId) {
      set({ ...createInitialState(), accountId: undefined, selectedBucket: undefined });
      return;
    }
    const previousAccountId = get().accountId;
    const switchingAccount = previousAccountId && previousAccountId !== accountId;
    set({
      loading: true,
      error: undefined,
      accountId,
      buckets: switchingAccount ? [] : get().buckets,
      selectedBucket: switchingAccount ? undefined : get().selectedBucket,
      isFromCache: false,
    });
    const useBridge = isBridgeAvailable();
    const offlineEnabled = usePreferencesStore.getState().offlineCacheEnabled;
    try {
      let buckets: BucketModel[] = [];
      let isFromCache = false;
      let lastSync = Date.now();

      if (offlineEnabled) {
        const result = await offlineManager.listBuckets(accountId, async () => {
          const payload = useBridge ? await ListBuckets(accountId) : FALLBACK_BUCKETS;
          return payload.map((bucket) => normalizeBucket(bucket));
        });
        buckets = result.items.map((bucket) => normalizeBucket(bucket));
        isFromCache = result.source === "cache";
        lastSync = result.lastSyncedAt ?? Date.now();
      } else {
        const payload = useBridge ? await ListBuckets(accountId) : FALLBACK_BUCKETS;
        buckets = payload.map((bucket) => normalizeBucket(bucket));
      }

      const previous = get().selectedBucket;
      const nextSelected =
        previous && buckets.some((bucket) => bucket.name === previous)
          ? previous
          : buckets[0]?.name;
      set({
        buckets,
        loading: false,
        error: undefined,
        selectedBucket: nextSelected,
        isFromCache,
        lastSync,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载 Bucket 失败";
      set({ loading: false, error: message });
      console.error(error);
      return;
    }
  },
  refresh: async () => {
    const accountId = get().accountId;
    if (accountId) {
      await get().loadBuckets(accountId);
    }
  },
  createBucket: async (accountId: string, payload: BucketCreateInput) => {
    const targetAccount = accountId || get().accountId;
    if (!targetAccount) {
      throw new Error("必须先选择账户");
    }
    const bucketName = payload.name?.trim() ?? "";
    if (!bucketName) {
      throw new Error("Bucket 名称不能为空");
    }
    const normalizedRegion = (payload.region || "").trim();
    const sanitized: BucketCreateInput = {
      name: bucketName,
      region: normalizedRegion,
      acl: payload.acl?.trim() ?? "",
      storageClass: payload.storageClass?.trim() ?? "",
      cosMultiAz: Boolean(payload.cosMultiAz),
    };
    set({ creating: true, error: undefined });
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        await CreateBucket(targetAccount, sanitized);
        await get().loadBuckets(targetAccount);
      } else {
        const mock: BucketModel = {
          name: bucketName,
          region: sanitized.region || "us-east-1",
          objectCount: 0,
          size: 0,
          createdAt: new Date().toISOString() as any,
        };
        set((state) => ({
          buckets: [...state.buckets, mock],
          selectedBucket: mock.name,
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建 Bucket 失败";
      set({ error: message });
      throw error;
    } finally {
      set({ creating: false });
    }
  },
  deleteBucket: async (accountId: string, name: string) => {
    const targetAccount = accountId || get().accountId;
    if (!targetAccount || !name) return;
    set((state) => ({ deleting: { ...state.deleting, [name]: true }, error: undefined }));
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        await DeleteBucket(targetAccount, name);
      }
      set((state) => {
        const filtered = state.buckets.filter((bucket) => bucket.name !== name);
        const selectedBucket =
          state.selectedBucket === name ? filtered[0]?.name : state.selectedBucket;
        const { [name]: _, ...rest } = state.deleting;
        return { buckets: filtered, deleting: rest, selectedBucket };
      });
      // Update cache
      if (usePreferencesStore.getState().offlineCacheEnabled) {
        void get().refresh();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除 Bucket 失败";
      set((state) => {
        const { [name]: _, ...rest } = state.deleting;
        return { deleting: rest, error: message };
      });
      throw error;
    }
  },
  selectBucket: (name: string) => {
    set({ selectedBucket: name });
  },
  reset: () => set({ ...createInitialState(), accountId: undefined, selectedBucket: undefined }),
}));

export const useBucketsStore = <T>(selector: (state: BucketsState) => T): T =>
  useBucketsStoreBase(selector as (state: BucketsStore) => T);

const relay = <Args extends unknown[], Return>(
  selector: (store: BucketsStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useBucketsStoreBase.getState())(...args);
};

export const bucketsStore = {
  loadBuckets: relay((store) => store.loadBuckets),
  refresh: relay((store) => store.refresh),
  createBucket: relay((store) => store.createBucket),
  deleteBucket: relay((store) => store.deleteBucket),
  selectBucket: relay((store) => store.selectBucket),
  reset: relay((store) => store.reset),
};
