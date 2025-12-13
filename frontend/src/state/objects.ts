import { isDesktopMode } from "@/lib/bridge";
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
  selectedKeysVersion: number;
  lastSelectedKey: string | null;
  selecting: boolean;
  // Pagination
  pageSize: number;
};

export type ObjectsActions = {
  setContext: (accountId?: string, bucket?: string, delimiter?: string) => Promise<void>;
  enterPrefix: (prefix: string) => Promise<void>;
  goUp: () => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  setDelimiter: (delimiter: string) => Promise<void>;
  setPageSize: (size: number) => void;
  listChildren: (params: {
    accountId: string;
    bucket: string;
    prefix: string;
    delimiter?: string;
  }) => Promise<ObjectModel[]>;
  listChildrenPaginated: (params: {
    accountId: string;
    bucket: string;
    prefix: string;
    delimiter?: string;
    limit?: number;
    marker?: string;
  }) => Promise<{ items: ObjectModel[]; truncated: boolean; nextMarker?: string }>;
  uploadFromPath: (filePath: string, key: string) => Promise<void>;
  downloadToPath: (key: string, savePath: string) => Promise<void>;
  deleteObject: (key: string) => Promise<void>;
  reset: () => void;
  // Selection actions
  toggleSelect: (key: string) => void;
  selectAll: (keys?: string[]) => void;
  selectRange: (keys: string[], opts?: { merge?: boolean }) => void;
  setLastSelectedKey: (key: string | null) => void;
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
  selectedKeysVersion: 0,
  lastSelectedKey: null,
  selecting: false,
  pageSize: 30,
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
    set((state) => ({
      accountId,
      bucket,
      prefix: "",
      delimiter: effectiveDelimiter,
      objects: [],
      nextMarker: undefined,
      truncated: false,
      error: undefined,
      selectedKeys: new Set<string>(),
      lastSelectedKey: null,
      selectedKeysVersion: state.selectedKeysVersion + 1,
    }));
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
    const { accountId, bucket, prefix, delimiter, pageSize } = get();
    if (!accountId || !bucket) {
      set({ objects: [], error: undefined });
      return;
    }
    set({
      loading: true,
      error: undefined,
      nextMarker: undefined,
      truncated: false,
    });
    const useBridge = isDesktopMode();
    try {
      let objects: ObjectModel[] = [];
      let nextMarker: string | undefined;
      let truncated = false;

      if (useBridge) {
        const payload = await ListObjects(accountId, {
          bucket,
          prefix,
          delimiter,
          limit: pageSize,
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
        const { delimiter, pageSize } = get();
        const result = await ListObjects(accountId, {
          bucket,
          prefix,
          delimiter,
          limit: pageSize,
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
        await UploadObject(accountId, bucket, finalKey, filePath);
        transfersStore.syncBackendTasks();
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
  setDelimiter: async (delimiter: string) => {
    set({ delimiter, nextMarker: undefined, truncated: false });
    // Auto-reload if context is set
    const state = get();
    if (state.accountId && state.bucket) {
      await get().refresh();
    }
  },
  setPageSize: (size: number) => {
    set({ pageSize: size, nextMarker: undefined, truncated: false });
    void get().refresh();
  },
  listChildren: async ({ accountId, bucket, prefix, delimiter = "/" }) => {
    if (!accountId || !bucket) {
      return [];
    }
    const useBridge = isDesktopMode();
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
  listChildrenPaginated: async ({ accountId, bucket, prefix, delimiter = "/", limit, marker }) => {
    if (!accountId || !bucket) {
      return { items: [], truncated: false };
    }
    const useBridge = isDesktopMode();
    const pageSize = limit ?? get().pageSize;
    if (useBridge) {
      const payload = await ListObjects(accountId, {
        bucket,
        prefix,
        delimiter,
        limit: pageSize,
        marker: marker ?? "",
      });
      const items = payload.objects
        .map((obj) => normalizeObject(obj))
        .filter((obj) => obj.key !== prefix);
      return {
        items,
        truncated: Boolean(payload.truncated),
        nextMarker: payload.nextMarker || undefined,
      };
    }
    const fallback = FALLBACK_OBJECTS.filter((obj) => !prefix || obj.key.startsWith(prefix))
      .filter((obj) => obj.key !== prefix)
      .map((obj) => normalizeObject(obj));
    return { items: fallback, truncated: false };
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
      return { selectedKeys: newSet, selectedKeysVersion: state.selectedKeysVersion + 1 };
    });
  },
  selectAll: (keys?: string[]) => {
    set((state) => {
      const fallback = state.objects.filter((o) => !o.isDir).map((o) => o.key);
      const nextKeys = keys && keys.length > 0 ? keys : fallback;
      return {
        selectedKeys: new Set(nextKeys),
        selectedKeysVersion: state.selectedKeysVersion + 1,
      };
    });
  },
  selectRange: (keys: string[], opts?: { merge?: boolean }) => {
    set((state) => {
      const base = opts?.merge ? new Set(state.selectedKeys) : new Set<string>();
      for (const k of keys) {
        base.add(k);
      }
      return { selectedKeys: base, selectedKeysVersion: state.selectedKeysVersion + 1 };
    });
  },
  setLastSelectedKey: (key: string | null) => {
    set({ lastSelectedKey: key });
  },
  clearSelection: () => {
    set((state) => ({
      selectedKeys: new Set<string>(),
      lastSelectedKey: null,
      selectedKeysVersion: state.selectedKeysVersion + 1,
    }));
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
    // Rename is copy to new key + delete old key
    await CopyObject(accountId, bucket, oldKey, bucket, newKey);
    await DeleteObject(accountId, bucket, oldKey);
    await get().refresh();
  },

  moveObjects: async (requests: ObjectModels.MoveObjectRequest[]) => {
    const { accountId } = get();
    if (!accountId) throw new Error("请选择账户");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    const result = await MoveObjects(accountId, requests);
    await get().refresh();
    return result;
  },

  createFolder: async (folderName: string) => {
    const { accountId, bucket, prefix } = get();
    if (!accountId || !bucket) throw new Error("请选择 Bucket");
    if (!isDesktopMode()) throw new Error("Bridge 未就绪");
    const folderPrefix = prefix + folderName.replace(/\/$/, "") + "/";
    await CreateFolder(accountId, bucket, folderPrefix);
    await get().refresh();
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
  setDelimiter: relay((store) => store.setDelimiter),
  setPageSize: relay((store) => store.setPageSize),
  listChildren: relay((store) => store.listChildren),
  listChildrenPaginated: relay((store) => store.listChildrenPaginated),
  uploadFromPath: relay((store) => store.uploadFromPath),
  downloadToPath: relay((store) => store.downloadToPath),
  deleteObject: relay((store) => store.deleteObject),
  reset: relay((store) => store.reset),
  // Selection
  toggleSelect: relay((store) => store.toggleSelect),
  selectAll: relay((store) => store.selectAll),
  selectRange: relay((store) => store.selectRange),
  setLastSelectedKey: relay((store) => store.setLastSelectedKey),
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
