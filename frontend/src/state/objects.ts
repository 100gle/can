import { isDesktopMode } from "@/lib/bridge";
import { offlineManager } from "@/lib/offline";
import { usePreferencesStore } from "@/state/preferences";
import { transfersStore } from "@/state/transfers";
import {
  BatchUpdateObjectAttributes,
  CopyObject,
  DownloadBatch,
  DownloadObject,
  GetObjectAttributes,
  ListObjects,
  UpdateObjectAttributes,
} from "@wailsjs/go/app/App";
import type { objects as ObjectModels } from "@wailsjs/go/models";
import { toast } from "sonner";
import { create } from "zustand";

export type ObjectModel = ObjectModels.ObjectInfo;

export type ObjectsState = {
  accountId?: string;
  bucket?: string;
  prefix: string;
  delimiter: string;
  objects: ObjectModel[];
  loading: boolean;
  loadingMore: boolean;
  uploading: boolean;
  error?: string;
  nextMarker?: string;
  truncated: boolean;
  pendingKeys: Record<string, "deleting" | "downloading">;
  // Selection state
  selectedKeys: Set<string>;
  selecting: boolean;
  isFromCache: boolean;
  lastSync?: number;
};

export type ObjectsActions = {
  setContext: (accountId?: string, bucket?: string, delimiter?: string) => Promise<void>;
  enterPrefix: (prefix: string) => Promise<void>;
  goUp: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setDelimiter: (delimiter: string) => Promise<void>;
  listChildren: (params: {
    accountId: string;
    bucket: string;
    prefix: string;
    delimiter?: string;
  }) => Promise<ObjectModel[]>;
  uploadFromPath: (filePath: string, key: string) => Promise<void>;
  downloadToPath: (key: string, savePath: string) => Promise<void>;
  deleteObject: (key: string) => Promise<void>;
  reset: () => void;
  // Selection actions
  toggleSelect: (key: string) => void;
  selectAll: (keys?: string[]) => void;
  clearSelection: () => void;
  // Object operations
  copyObject: (sourceKey: string, targetBucket: string, targetKey: string) => Promise<void>;
  renameObject: (oldKey: string, newKey: string) => Promise<void>;
  moveObjects: (
    requests: ObjectModels.MoveObjectRequest[],
  ) => Promise<ObjectModels.MoveObjectsResult | undefined>;
  createFolder: (folderName: string) => Promise<void>;
  // Attributes
  getObjectAttributes: (key: string) => Promise<ObjectModels.ObjectAttributes>;
  updateObjectAttributes: (
    patch: ObjectModels.ObjectAttributesPatch,
  ) => Promise<ObjectModels.ObjectAttributes>;
  batchUpdateAttributes: (
    patches: ObjectModels.ObjectAttributesPatch[],
  ) => Promise<ObjectModels.BatchAttributesResult>;
  // Batch download
  downloadBatch: (input: ObjectModels.DownloadBatchInput) => Promise<void>;
  // Batch delete
  deleteSelected: () => Promise<void>;
};

type ObjectsStore = ObjectsState & ObjectsActions;

const createInitialState = (): ObjectsState => ({
  prefix: "",
  delimiter: "/",
  objects: [],
  loading: false,
  loadingMore: false,
  uploading: false,
  truncated: false,
  pendingKeys: {},
  selectedKeys: new Set<string>(),
  selecting: false,
  isFromCache: false,
});

const FALLBACK_OBJECTS: ObjectModel[] = [
  {
    key: "media/",
    size: 0,
    lastModified: new Date().toISOString() as any,
    etag: "",
    contentType: "",
    storageClass: "",
    versionId: "",
    isDir: true,
    metadata: {},
    isSymlink: false,
    symlinkTarget: "",
  },
  {
    key: "media/banner.png",
    size: 245678,
    lastModified: new Date().toISOString() as any,
    etag: "etag-1",
    contentType: "image/png",
    storageClass: "STANDARD",
    versionId: "",
    isDir: false,
    metadata: {},
    isSymlink: false,
    symlinkTarget: "",
  },
  {
    key: "readme.txt",
    size: 128,
    lastModified: new Date().toISOString() as any,
    etag: "etag-2",
    contentType: "text/plain",
    storageClass: "STANDARD",
    versionId: "",
    isDir: false,
    metadata: {},
    isSymlink: false,
    symlinkTarget: "",
  },
];

const normalizeObject = (object: ObjectModels.ObjectInfo | ObjectModel): ObjectModel => ({
  ...(object as ObjectModel),
});

const useObjectsStoreBase = create<ObjectsStore>((set, get) => ({
  ...createInitialState(),
  setContext: async (accountId?: string, bucket?: string, delimiter?: string) => {
    if (!accountId || !bucket) {
      set({ ...createInitialState(), accountId: undefined, bucket: undefined });
      return;
    }
    // Use provided delimiter or preserve current value
    const effectiveDelimiter = delimiter ?? get().delimiter;
    set({
      accountId,
      bucket,
      prefix: "",
      delimiter: effectiveDelimiter,
      objects: [],
      nextMarker: undefined,
      truncated: false,
      error: undefined,
      isFromCache: false,
    });
    await get().refresh();
  },
  enterPrefix: async (prefix: string) => {
    set({ prefix, nextMarker: undefined });
    await get().refresh();
  },
  goUp: async () => {
    const current = get().prefix.replace(/\/$/, "");
    if (!current) {
      set({ prefix: "" });
      await get().refresh();
      return;
    }
    const segments = current.split("/").filter(Boolean);
    segments.pop();
    const parent = segments.length ? `${segments.join("/")}/` : "";
    set({ prefix: parent, nextMarker: undefined });
    await get().refresh();
  },
  refresh: async () => {
    const { accountId, bucket, prefix, delimiter } = get();
    if (!accountId || !bucket) {
      set({ objects: [], error: undefined });
      return;
    }
    set({
      loading: true,
      error: undefined,
      nextMarker: undefined,
      truncated: false,
      isFromCache: false,
    });
    const useBridge = isDesktopMode();
    const offlineEnabled = usePreferencesStore.getState().offlineCacheEnabled;
    try {
      let objects: ObjectModel[] = [];
      let nextMarker: string | undefined;
      let truncated = false;
      let isFromCache = false;
      let lastSync = Date.now();

      if (offlineEnabled) {
        const result = await offlineManager.listObjects(
          { accountId, bucket, prefix, delimiter },
          async () => {
            if (useBridge) {
              const payload = await ListObjects(accountId, {
                bucket,
                prefix,
                delimiter,
                limit: 500,
                marker: "",
              });
              return {
                items: payload.objects.map((object) => normalizeObject(object)),
                truncated: Boolean(payload.truncated),
                nextMarker: payload.nextMarker || undefined,
              };
            }
            const fallback = FALLBACK_OBJECTS.filter((object) =>
              !prefix ? true : object.key.startsWith(prefix),
            ).map((object) => normalizeObject(object));
            return {
              items: fallback,
              truncated: false,
              nextMarker: undefined,
            };
          },
        );
        objects = result.items;
        nextMarker = result.nextMarker;
        truncated = Boolean(result.truncated);
        isFromCache = result.source === "cache";
        lastSync = result.lastSyncedAt ?? Date.now();
      } else if (useBridge) {
        const payload = await ListObjects(accountId, {
          bucket,
          prefix,
          delimiter,
          limit: 500,
          marker: "",
        });
        objects = payload.objects.map((object) => normalizeObject(object));
        nextMarker = payload.nextMarker || undefined;
        truncated = Boolean(payload.truncated);
      } else {
        objects = FALLBACK_OBJECTS.filter((object) => !prefix || object.key.startsWith(prefix)).map(
          (object) => normalizeObject(object),
        );
      }

      set({
        objects,
        loading: false,
        nextMarker,
        truncated,
        isFromCache,
        lastSync,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载对象失败";
      set({ loading: false, error: message });
      return;
    }
  },
  loadMore: async () => {
    const { accountId, bucket, prefix, nextMarker, truncated } = get();
    if (!accountId || !bucket || !truncated || !nextMarker) return;
    set({ loadingMore: true, error: undefined });
    const useBridge = isDesktopMode();
    try {
      if (useBridge) {
        const { delimiter } = get();
        const result = await ListObjects(accountId, {
          bucket,
          prefix,
          delimiter,
          limit: 500,
          marker: nextMarker,
        });
        set((state) => ({
          objects: [...state.objects, ...result.objects.map((object) => normalizeObject(object))],
          loadingMore: false,
          nextMarker: result.nextMarker || undefined,
          truncated: Boolean(result.truncated),
        }));
      } else {
        const fallback = FALLBACK_OBJECTS.filter(
          (object) => !prefix || object.key.startsWith(prefix),
        ).map((object) => normalizeObject(object));
        set((state) => ({
          objects: [...state.objects, ...fallback],
          loadingMore: false,
          nextMarker: undefined,
          truncated: false,
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载更多对象失败";
      set({ loadingMore: false, error: message });
      return;
    }
  },
  uploadFromPath: async (filePath: string, key: string) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) {
      throw new Error("请选择 Bucket");
    }
    const finalKey = key.trim();
    if (!finalKey) {
      throw new Error("对象 Key 不能为空");
    }
    set({ uploading: true, error: undefined });
    const useBridge = isDesktopMode();
    try {
      if (useBridge) {
        const result = await offlineManager.uploadObject({
          accountId,
          bucket,
          key: finalKey,
          filePath,
        });
        if (result.status === "executed") {
          transfersStore.syncBackendTasks();
        } else {
          toast.info("已加入离线队列", {
            description: `上传 ${finalKey} 将在网络恢复后执行`,
          });
        }
      } else {
        const mock: ObjectModel = {
          key: finalKey,
          size: Math.round(Math.random() * 1_000_000),
          lastModified: new Date().toISOString() as any,
          etag: `mock-${Date.now()}`,
          contentType: "application/octet-stream",
          storageClass: "STANDARD",
          versionId: "",
          isDir: false,
          metadata: {},
          isSymlink: false,
          symlinkTarget: "",
        };
        set((state) => ({ objects: [mock, ...state.objects] }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "上传失败";
      set({ error: message });
      throw error;
    } finally {
      set({ uploading: false });
    }
  },
  downloadToPath: async (key: string, savePath: string) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) {
      throw new Error("请选择 Bucket");
    }
    set((state) => ({
      pendingKeys: { ...state.pendingKeys, [key]: "downloading" },
      error: undefined,
    }));
    const useBridge = isDesktopMode();
    try {
      if (useBridge) {
        const task = await DownloadObject(accountId, bucket, key, savePath);
        if (task?.id) {
          await transfersStore.syncBackendTasks();
        }
        return;
      }
      // 浏览器模式尚未实现下载
    } catch (error) {
      const message = error instanceof Error ? error.message : "下载失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => {
        const { [key]: _, ...rest } = state.pendingKeys;
        return { pendingKeys: rest };
      });
    }
  },
  deleteObject: async (key: string) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) {
      throw new Error("请选择 Bucket");
    }
    set((state) => ({
      pendingKeys: { ...state.pendingKeys, [key]: "deleting" },
      error: undefined,
    }));
    const useBridge = isDesktopMode();
    try {
      let shouldRemove = false;
      const target = get().objects.find((object) => object.key === key);
      const versionToken = target?.etag || target?.lastModified || undefined;
      if (useBridge) {
        const result = await offlineManager.deleteObject({
          accountId,
          bucket,
          key,
          versionToken,
        });
        if (result.status === "executed") {
          shouldRemove = true;
        } else {
          toast.info("删除已排队", {
            description: `对象 ${key} 将在网络恢复后删除`,
          });
        }
      } else {
        shouldRemove = true;
      }
      if (shouldRemove) {
        set((state) => {
          const filtered = state.objects.filter((object) => object.key !== key);
          return { objects: filtered };
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      set({ error: message });
      throw error;
    } finally {
      set((state) => {
        const { [key]: _, ...rest } = state.pendingKeys;
        return { pendingKeys: rest };
      });
    }
  },
  reset: () => set({ ...createInitialState(), accountId: undefined, bucket: undefined }),
  setDelimiter: async (delimiter: string) => {
    set({ delimiter, nextMarker: undefined, truncated: false });
    // Auto-reload if context is set
    const state = get();
    if (state.accountId && state.bucket) {
      await get().refresh();
    }
  },
  listChildren: async ({ accountId, bucket, prefix, delimiter = "/" }) => {
    if (!accountId || !bucket) {
      return [];
    }
    const useBridge = isDesktopMode();
    const offlineEnabled = usePreferencesStore.getState().offlineCacheEnabled;
    if (offlineEnabled) {
      const result = await offlineManager.listObjects(
        { accountId, bucket, prefix, delimiter },
        async () => {
          if (useBridge) {
            const payload = await ListObjects(accountId, {
              bucket,
              prefix,
              delimiter,
              limit: 500,
              marker: "",
            });
            return {
              items: payload.objects.map((object) => normalizeObject(object)),
              truncated: Boolean(payload.truncated),
              nextMarker: payload.nextMarker || undefined,
            };
          }
          const fallback = FALLBACK_OBJECTS.filter((object) =>
            !prefix ? true : object.key.startsWith(prefix),
          ).map((object) => normalizeObject(object));
          return {
            items: fallback,
            truncated: false,
            nextMarker: undefined,
          };
        },
      );
      return result.items;
    }
    if (useBridge) {
      const payload = await ListObjects(accountId, {
        bucket,
        prefix,
        delimiter,
        limit: 500,
        marker: "",
      });
      return payload.objects.map((object) => normalizeObject(object));
    }
    return FALLBACK_OBJECTS.filter((object) => !prefix || object.key.startsWith(prefix)).map(
      (object) => normalizeObject(object),
    );
  },

  // Selection actions
  toggleSelect: (key: string) => {
    set((state) => {
      const newSet = new Set(state.selectedKeys);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return { selectedKeys: newSet };
    });
  },
  selectAll: (keys?: string[]) => {
    set((state) => {
      const fallback = state.objects.filter((o) => !o.isDir).map((o) => o.key);
      const nextKeys = keys && keys.length > 0 ? keys : fallback;
      return { selectedKeys: new Set(nextKeys) };
    });
  },
  clearSelection: () => {
    set({ selectedKeys: new Set<string>() });
  },

  // Object operations
  copyObject: async (sourceKey: string, targetBucket: string, targetKey: string) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    await CopyObject(accountId, bucket, sourceKey, targetBucket, targetKey);
    await get().refresh();
  },

  renameObject: async (oldKey: string, newKey: string) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    const target = get().objects.find((object) => object.key === oldKey);
    const versionToken = target?.etag || target?.lastModified || undefined;
    const result = await offlineManager.renameObject({
      accountId,
      bucket,
      oldKey,
      newKey,
      versionToken,
    });
    if (result.status === "executed") {
      await get().refresh();
    } else {
      toast.info("重命名已排队", {
        description: `${oldKey} → ${newKey} 将在网络恢复后执行`,
      });
    }
  },

  moveObjects: async (requests: ObjectModels.MoveObjectRequest[]) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    const execution = await offlineManager.moveObjects({
      accountId,
      requests,
    });
    if (execution.status === "executed") {
      await get().refresh();
      return execution.result;
    }
    toast.info("移动已排队", {
      description: `共 ${requests.length} 个操作将在恢复网络后执行`,
    });
    return undefined;
  },

  createFolder: async (folderName: string) => {
    const { accountId, bucket, prefix } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    const folderPrefix = prefix + folderName.replace(/\/$/, "") + "/";
    const result = await offlineManager.createFolder({
      accountId,
      bucket,
      key: folderPrefix,
    });
    if (result.status === "executed") {
      await get().refresh();
    } else {
      toast.info("创建文件夹已排队", {
        description: `${folderPrefix} 将在网络恢复后创建`,
      });
    }
  },

  // Attributes
  getObjectAttributes: async (key: string) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    return await GetObjectAttributes(accountId, bucket, key);
  },

  updateObjectAttributes: async (patch: ObjectModels.ObjectAttributesPatch) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    const result = await UpdateObjectAttributes(accountId, patch);
    await get().refresh();
    return result;
  },

  batchUpdateAttributes: async (patches: ObjectModels.ObjectAttributesPatch[]) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    const result = await BatchUpdateObjectAttributes(accountId, patches);
    await get().refresh();
    return result;
  },

  // Batch download
  downloadBatch: async (input: ObjectModels.DownloadBatchInput) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (isDesktopMode()) {
      // Desktop mode: use backend batch download
      const task = await DownloadBatch(accountId, input);
      if (task?.id) {
        await transfersStore.syncBackendTasks();
      }
    } else {
      // Browser mode: fallback to presigned URL downloads
      const keys = input.entries?.map((e) => e.key) ?? [];
      await transfersStore.downloadFiles(keys, { accountId, bucket: input.bucket });
    }
  },

  // Batch delete
  deleteSelected: async () => {
    const { accountId, bucket, selectedKeys } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    if (selectedKeys.size === 0) return;

    set({ selecting: true, error: undefined });
    const errors: string[] = [];
    const queued: string[] = [];
    for (const key of selectedKeys) {
      try {
        const target = get().objects.find((object) => object.key === key);
        const versionToken = target?.etag || target?.lastModified || undefined;
        const execution = await offlineManager.deleteObject({
          accountId,
          bucket,
          key,
          versionToken,
        });
        if (execution.status === "queued") {
          queued.push(key);
        }
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : "失败"}`);
      }
    }
    set({ selecting: false, selectedKeys: new Set<string>() });
    if (errors.length > 0) {
      set({ error: `部分删除失败: ${errors.join(", ")}` });
    }
    if (queued.length > 0) {
      toast.info("部分删除已排队", {
        description: `${queued.length} 个对象将在网络恢复后删除`,
      });
    }
    await get().refresh();
  },
}));

export const useObjectsStore = <T>(selector: (state: ObjectsState) => T): T =>
  useObjectsStoreBase(selector as (state: ObjectsStore) => T);

const relay = <Args extends unknown[], Return>(
  selector: (store: ObjectsStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useObjectsStoreBase.getState())(...args);
};

export const objectsStore = {
  setContext: relay((store) => store.setContext),
  enterPrefix: relay((store) => store.enterPrefix),
  goUp: relay((store) => store.goUp),
  refresh: relay((store) => store.refresh),
  loadMore: relay((store) => store.loadMore),
  setDelimiter: relay((store) => store.setDelimiter),
  listChildren: relay((store) => store.listChildren),
  uploadFromPath: relay((store) => store.uploadFromPath),
  downloadToPath: relay((store) => store.downloadToPath),
  deleteObject: relay((store) => store.deleteObject),
  reset: relay((store) => store.reset),
  // Selection
  toggleSelect: relay((store) => store.toggleSelect),
  selectAll: relay((store) => store.selectAll),
  clearSelection: relay((store) => store.clearSelection),
  // Operations
  copyObject: relay((store) => store.copyObject),
  renameObject: relay((store) => store.renameObject),
  moveObjects: relay((store) => store.moveObjects),
  createFolder: relay((store) => store.createFolder),
  // Attributes
  getObjectAttributes: relay((store) => store.getObjectAttributes),
  updateObjectAttributes: relay((store) => store.updateObjectAttributes),
  batchUpdateAttributes: relay((store) => store.batchUpdateAttributes),
  // Batch
  downloadBatch: relay((store) => store.downloadBatch),
  deleteSelected: relay((store) => store.deleteSelected),
  // Helper to get current state snapshot
  getState: () => useObjectsStoreBase.getState(),
};
