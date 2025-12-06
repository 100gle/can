import { isBridgeAvailable } from "@/lib/bridge";
import { transfersStore } from "@/state/transfers";
import { DeleteObject, DownloadObject, ListObjects, UploadObject } from "@wailsjs/go/main/App";
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
});

const FALLBACK_OBJECTS: ObjectModel[] = [
  {
    key: "media/",
    size: 0,
    lastModified: new Date().toISOString() as any,
    etag: "",
    contentType: "",
    isDir: true,
  },
  {
    key: "media/banner.png",
    size: 245678,
    lastModified: new Date().toISOString() as any,
    etag: "etag-1",
    contentType: "image/png",
    isDir: false,
  },
  {
    key: "readme.txt",
    size: 128,
    lastModified: new Date().toISOString() as any,
    etag: "etag-2",
    contentType: "text/plain",
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
};
