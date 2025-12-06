import { isBridgeAvailable } from "@/lib/bridge";
import { transfersStore } from "@/state/transfers";
import {
  BatchUpdateObjectAttributes,
  CopyObject,
  CreateFolder,
  DeleteObject,
  DownloadBatch,
  DownloadObject,
  GetObjectAttributes,
  ListObjects,
  MoveObjects,
  RenameObject,
  UpdateObjectAttributes,
  UploadObject,
} from "@wailsjs/go/app/App";
import type { objects as ObjectModels } from "@wailsjs/go/models";
import { create } from "zustand";

export type ObjectModel = ObjectModels.ObjectInfo;

export type ObjectsState = {
  accountId?: string;
  bucket?: string;
  prefix: string;
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
};

export type ObjectsActions = {
  setContext: (accountId?: string, bucket?: string) => Promise<void>;
  enterPrefix: (prefix: string) => Promise<void>;
  goUp: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
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
  ) => Promise<ObjectModels.MoveObjectsResult>;
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
  objects: [],
  loading: false,
  loadingMore: false,
  uploading: false,
  truncated: false,
  pendingKeys: {},
  selectedKeys: new Set<string>(),
  selecting: false,
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
  },
];

const normalizeObject = (object: ObjectModels.ObjectInfo | ObjectModel): ObjectModel => ({
  ...(object as ObjectModel),
});

const useObjectsStoreBase = create<ObjectsStore>((set, get) => ({
  ...createInitialState(),
  setContext: async (accountId?: string, bucket?: string) => {
    if (!accountId || !bucket) {
      set({ ...createInitialState(), accountId: undefined, bucket: undefined });
      return;
    }
    set({
      accountId,
      bucket,
      prefix: "",
      objects: [],
      nextMarker: undefined,
      truncated: false,
      error: undefined,
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
    const { accountId, bucket, prefix } = get();
    if (!accountId || !bucket) {
      set({ objects: [], error: undefined });
      return;
    }
    set({ loading: true, error: undefined, nextMarker: undefined, truncated: false });
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        const result = await ListObjects(accountId, {
          bucket,
          prefix,
          delimiter: "/",
          limit: 500,
          marker: "",
        });
        set({
          objects: result.objects.map((object) => normalizeObject(object)),
          loading: false,
          nextMarker: result.nextMarker || undefined,
          truncated: Boolean(result.truncated),
        });
      } else {
        set({
          objects: FALLBACK_OBJECTS.filter(
            (object) => !prefix || object.key.startsWith(prefix),
          ).map((object) => normalizeObject(object)),
          loading: false,
          nextMarker: undefined,
          truncated: false,
        });
      }
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
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        const result = await ListObjects(accountId, {
          bucket,
          prefix,
          delimiter: "/",
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
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        const task = await UploadObject(accountId, bucket, finalKey, filePath);
        if (task?.id) {
          transfersStore.syncBackendTasks();
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
    const useBridge = isBridgeAvailable();
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
    const useBridge = isBridgeAvailable();
    try {
      if (useBridge) {
        await DeleteObject(accountId, bucket, key);
      }
      set((state) => {
        const filtered = state.objects.filter((object) => object.key !== key);
        return { objects: filtered };
      });
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
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    await CopyObject(accountId, bucket, sourceKey, targetBucket, targetKey);
    await get().refresh();
  },

  renameObject: async (oldKey: string, newKey: string) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    await RenameObject(accountId, bucket, oldKey, newKey);
    await get().refresh();
  },

  moveObjects: async (requests: ObjectModels.MoveObjectRequest[]) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    const result = await MoveObjects(accountId, requests);
    await get().refresh();
    return result;
  },

  createFolder: async (folderName: string) => {
    const { accountId, bucket, prefix } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    const folderPrefix = prefix + folderName.replace(/\/$/, "") + "/";
    await CreateFolder(accountId, bucket, folderPrefix);
    await get().refresh();
  },

  // Attributes
  getObjectAttributes: async (key: string) => {
    const { accountId, bucket } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    return await GetObjectAttributes(accountId, bucket, key);
  },

  updateObjectAttributes: async (patch: ObjectModels.ObjectAttributesPatch) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    const result = await UpdateObjectAttributes(accountId, patch);
    await get().refresh();
    return result;
  },

  batchUpdateAttributes: async (patches: ObjectModels.ObjectAttributesPatch[]) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    const result = await BatchUpdateObjectAttributes(accountId, patches);
    await get().refresh();
    return result;
  },

  // Batch download
  downloadBatch: async (input: ObjectModels.DownloadBatchInput) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    const task = await DownloadBatch(accountId, input);
    if (task?.id) {
      await transfersStore.syncBackendTasks();
    }
  },

  // Batch delete
  deleteSelected: async () => {
    const { accountId, bucket, selectedKeys } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isBridgeAvailable()) throw new Error("Bridge 未就绪");
    if (selectedKeys.size === 0) return;

    set({ selecting: true, error: undefined });
    const errors: string[] = [];
    for (const key of selectedKeys) {
      try {
        await DeleteObject(accountId, bucket, key);
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : "失败"}`);
      }
    }
    set({ selecting: false, selectedKeys: new Set<string>() });
    if (errors.length > 0) {
      set({ error: `部分删除失败: ${errors.join(", ")}` });
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
