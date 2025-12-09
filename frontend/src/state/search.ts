import { isDesktopMode } from "@/lib/bridge";
import {
  DeleteSavedSearchQuery,
  ExportSearchResults,
  ListSavedSearchQueries,
  SaveSearchQuery,
  SearchObjects,
} from "@wailsjs/go/app/App";
import { create } from "zustand";

export type SearchQueryModel = {
  accountId: string;
  bucket: string;
  prefix: string;
  searchText: string;
  sortBy: string;
  sortOrder: string;
  minSize: number;
  maxSize: number;
  startTime?: string;
  endTime?: string;
  fileTypes: string[];
  tags: Record<string, string>;
  limit: number;
  offset: number;
};

export type SearchResultModel = {
  key: string;
  bucket: string;
  size: number;
  lastModified: any;
  etag: string;
  contentType: string;
  storageClass: string;
  tags?: Record<string, string>;
  score: number;
};

export type SavedQueryModel = {
  id: string;
  name: string;
  query: SearchQueryModel;
  createdAt: string;
  updatedAt: string;
};

export type SearchState = {
  accountId?: string;
  bucket?: string;
  query: SearchQueryModel;
  results: SearchResultModel[];
  savedQueries: SavedQueryModel[];
  loading: boolean;
  loadingMore: boolean;
  exporting: boolean;
  error?: string;
  hasMore: boolean;
  total: number;
  nextOffset: number;
};

export type SearchActions = {
  setContext: (accountId: string, bucket?: string) => void;
  setQuery: (query: Partial<SearchQueryModel>) => void;
  search: (overrides?: Partial<SearchQueryModel>) => Promise<void>;
  loadMore: () => Promise<void>;
  exportResults: (format: "csv" | "json") => Promise<void>;
  clear: () => void;
  // Saved Queries
  loadSavedQueries: () => Promise<void>;
  saveQuery: (name: string) => Promise<void>;
  deleteSavedQuery: (id: string) => Promise<void>;
  applySavedQuery: (saved: SavedQueryModel) => void;
};

type SearchStore = SearchState & SearchActions;

const defaultQuery = (): SearchQueryModel => ({
  accountId: "",
  bucket: "",
  prefix: "",
  searchText: "",
  sortBy: "name",
  sortOrder: "asc",
  minSize: 0,
  maxSize: 0,
  startTime: undefined,
  endTime: undefined,
  fileTypes: [],
  tags: {},
  limit: 100,
  offset: 0,
});

const FALLBACK_RESULTS: SearchResultModel[] = [
  {
    key: "reports/annual-2023.pdf",
    bucket: "product-assets",
    size: 2_048_000,
    lastModified: new Date().toISOString() as any,
    etag: "demo-1",
    contentType: "application/pdf",
    storageClass: "STANDARD",
    tags: { department: "finance" },
    score: 0.8,
  },
  {
    key: "media/banners/spring.jpg",
    bucket: "product-assets",
    size: 512_000,
    lastModified: new Date().toISOString() as any,
    etag: "demo-2",
    contentType: "image/jpeg",
    storageClass: "STANDARD",
    tags: { campaign: "spring" },
    score: 0.6,
  },
];

const saveAsFile = (bytes: number[], filename: string, type: string) => {
  if (typeof window === "undefined") return;
  const blob = new Blob([new Uint8Array(bytes)], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const useSearchStoreBase = create<SearchStore>((set, get) => ({
  accountId: undefined,
  bucket: undefined,
  query: defaultQuery(),
  results: [],
  savedQueries: [],
  loading: false,
  loadingMore: false,
  exporting: false,
  hasMore: false,
  total: 0,
  nextOffset: 0,
  setContext: (accountId: string, bucket?: string) => {
    set({
      accountId,
      bucket,
      query: {
        ...defaultQuery(),
        accountId,
        bucket: bucket ?? "",
      },
      results: [],
      total: 0,
      hasMore: false,
      nextOffset: 0,
      error: undefined,
    });
  },
  setQuery: (partial: Partial<SearchQueryModel>) => {
    set((state) => ({
      query: { ...state.query, ...partial },
    }));
  },
  search: async (overrides?: Partial<SearchQueryModel>) => {
    const { accountId, query, bucket } = get();
    if (!accountId) {
      throw new Error("请选择账户");
    }
    const effectiveQuery: SearchQueryModel = {
      ...query,
      ...overrides,
      accountId,
      bucket: overrides?.bucket ?? query.bucket ?? bucket ?? "",
      offset: 0,
    };
    set({ loading: true, error: undefined, query: effectiveQuery });
    const useBridge = isDesktopMode();
    try {
      if (useBridge) {
        const response = await SearchObjects(accountId, effectiveQuery as any);
        set({
          results: response.results?.map((item) => clone(item)) ?? [],
          loading: false,
          hasMore: Boolean(response.hasMore),
          total: response.total ?? 0,
          nextOffset: response.nextOffset ?? 0,
        });
      } else {
        set({
          results: FALLBACK_RESULTS,
          loading: false,
          hasMore: false,
          total: FALLBACK_RESULTS.length,
          nextOffset: FALLBACK_RESULTS.length,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "搜索失败";
      set({ loading: false, error: message });
      throw error;
    }
  },
  loadMore: async () => {
    const { accountId, query, hasMore, nextOffset } = get();
    if (!accountId || !hasMore || nextOffset <= 0) {
      return;
    }
    set({ loadingMore: true, error: undefined });
    const useBridge = isDesktopMode();
    try {
      if (useBridge) {
        const response = await SearchObjects(accountId, { ...query, offset: nextOffset } as any);
        set((state) => ({
          results: [...state.results, ...(response.results?.map((item) => clone(item)) ?? [])],
          loadingMore: false,
          hasMore: Boolean(response.hasMore),
          total: response.total ?? state.total,
          nextOffset: response.nextOffset ?? nextOffset,
          query: { ...state.query, offset: response.nextOffset ?? nextOffset },
        }));
      } else {
        set({ loadingMore: false, hasMore: false });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载更多失败";
      set({ loadingMore: false, error: message });
      throw error;
    }
  },
  exportResults: async (format: "csv" | "json") => {
    const { accountId, query } = get();
    if (!accountId) return;
    set({ exporting: true, error: undefined });
    const useBridge = isDesktopMode();
    try {
      if (useBridge) {
        const bytes = await ExportSearchResults(accountId, query as any, format);
        const filename = `search-results-${Date.now()}.${format}`;
        const mimeType = format === "csv" ? "text/csv" : "application/json";
        saveAsFile(bytes ?? [], filename, mimeType);
      } else {
        const payload =
          format === "csv"
            ? "key,bucket,size\nreports/annual-2023.pdf,product-assets,2048000"
            : JSON.stringify(FALLBACK_RESULTS, null, 2);
        saveAsFile(Array.from(new TextEncoder().encode(payload)), `demo.${format}`, "text/plain");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "导出失败";
      set({ error: message });
      throw error;
    } finally {
      set({ exporting: false });
    }
  },
  clear: () => {
    set({
      results: [],
      total: 0,
      hasMore: false,
      nextOffset: 0,
      error: undefined,
    });
  },
  loadSavedQueries: async () => {
    if (!isDesktopMode()) return;
    try {
      const list = await ListSavedSearchQueries();
      set({ savedQueries: list as any });
    } catch (error) {
      console.error("failed to load saved queries", error);
    }
  },
  saveQuery: async (name: string) => {
    const { query } = get();
    if (!isDesktopMode()) return;
    await SaveSearchQuery(name, query as any);
    await get().loadSavedQueries();
  },
  deleteSavedQuery: async (id: string) => {
    if (!isDesktopMode()) return;
    await DeleteSavedSearchQuery(id);
    await get().loadSavedQueries();
  },
  applySavedQuery: (saved: SavedQueryModel) => {
    set((state) => ({
      query: { ...state.query, ...saved.query, accountId: state.accountId ?? "" }, // Keep current account
    }));
  },
}));

export const useSearchStore = <T>(selector: (state: SearchState) => T): T =>
  useSearchStoreBase(selector as (state: SearchStore) => T);

const relay = <Args extends unknown[], Return>(
  selector: (store: SearchStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useSearchStoreBase.getState())(...args);
};

export const searchStore = {
  setContext: relay((store) => store.setContext),
  setQuery: relay((store) => store.setQuery),
  search: relay((store) => store.search),
  loadMore: relay((store) => store.loadMore),
  exportResults: relay((store) => store.exportResults),
  clear: relay((store) => store.clear),
  loadSavedQueries: relay((store) => store.loadSavedQueries),
  saveQuery: relay((store) => store.saveQuery),
  deleteSavedQuery: relay((store) => store.deleteSavedQuery),
  applySavedQuery: relay((store) => store.applySavedQuery),
};
const clone = <T>(value: T): T => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};
