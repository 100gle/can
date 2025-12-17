import { create } from "zustand";

export type ObjectsState = {
  // Context
  accountId?: string;
  bucket?: string;
  prefix: string;
  delimiter: string;

  // UI State
  pageSize: number;
  pendingKeys: Record<string, "deleting" | "downloading">;

  // Selection state
  selectedKeys: Set<string>;
  selectedKeysVersion: number;
  lastSelectedKey: string | null;
  selecting: boolean;
};

export type ObjectsActions = {
  setContext: (accountId?: string, bucket?: string, delimiter?: string) => void;
  enterPrefix: (prefix: string) => void;
  goUp: () => void;
  setDelimiter: (delimiter: string) => void;
  setPageSize: (size: number) => void;
  reset: () => void;

  // Selection actions
  toggleSelect: (key: string) => void;
  selectAll: (keys: string[]) => void;
  selectRange: (keys: string[], opts?: { merge?: boolean }) => void;
  setLastSelectedKey: (key: string | null) => void;
  clearSelection: () => void;
};

type ObjectsStore = ObjectsState & ObjectsActions;

const createInitialState = (): ObjectsState => ({
  prefix: "",
  delimiter: "/",
  pageSize: 30,
  pendingKeys: {},
  selectedKeys: new Set<string>(),
  selectedKeysVersion: 0,
  lastSelectedKey: null,
  selecting: false,
});

const useObjectsStoreBase = create<ObjectsStore>((set, get) => ({
  ...createInitialState(),

  setContext: (accountId?: string, bucket?: string, delimiter?: string) => {
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
      selectedKeys: new Set<string>(),
      lastSelectedKey: null,
      selectedKeysVersion: state.selectedKeysVersion + 1,
    }));
  },

  enterPrefix: (prefix: string) => {
    set({ prefix });
    // Clear selection when changing folders
    get().clearSelection();
  },

  goUp: () => {
    const current = get().prefix.replace(/\/$/, "");
    if (!current) {
      set({ prefix: "" });
      get().clearSelection();
      return;
    }
    const segments = current.split("/").filter(Boolean);
    segments.pop();
    const parent = segments.length ? `${segments.join("/")}/` : "";
    set({ prefix: parent });
    get().clearSelection();
  },

  setDelimiter: (delimiter: string) => {
    set({ delimiter });
  },

  setPageSize: (size: number) => {
    set({ pageSize: size });
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
      return { selectedKeys: newSet, selectedKeysVersion: state.selectedKeysVersion + 1 };
    });
  },

  selectAll: (keys: string[]) => {
    set((state) => {
      const nextKeys = keys;
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
}));

import { bindStore } from "./utils";

const { useStore: useObjectsStore, relay } = bindStore(useObjectsStoreBase);

export { useObjectsStore };

export const objectsStore = {
  setContext: relay((store) => store.setContext),
  enterPrefix: relay((store) => store.enterPrefix),
  goUp: relay((store) => store.goUp),
  setDelimiter: relay((store) => store.setDelimiter),
  setPageSize: relay((store) => store.setPageSize),
  reset: relay((store) => store.reset),
  // Selection
  toggleSelect: relay((store) => store.toggleSelect),
  selectAll: relay((store) => store.selectAll),
  selectRange: relay((store) => store.selectRange),
  setLastSelectedKey: relay((store) => store.setLastSelectedKey),
  clearSelection: relay((store) => store.clearSelection),
  // Helper to get current state snapshot
  getState: () => useObjectsStoreBase.getState(),
};

// Exporting types for compatibility
export type { ObjectModel } from "@/hooks/useObjects";
