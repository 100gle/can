import type { OfflineAction } from "@/lib/offline";
import { offlineManager } from "@/lib/offline";
import { create } from "zustand";

type OfflineQueueState = {
  actions: OfflineAction[];
  syncing: boolean;
  lastSyncTime: number | null;
  unsubscribe?: () => void;
};

type OfflineQueueActions = {
  startSyncWorker: () => void;
  stopSyncWorker: () => void;
  retryAction: (id: string) => Promise<void>;
  cancelAction: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  syncNow: () => Promise<void>;
  refreshStats: () => Promise<void>;
};

type OfflineQueueStore = OfflineQueueState & OfflineQueueActions;

const useOfflineQueueStoreBase = create<OfflineQueueStore>((set, get) => ({
  actions: [],
  syncing: false,
  lastSyncTime: null,
  unsubscribe: undefined,

  startSyncWorker: () => {
    if (get().unsubscribe) return;
    const unsubscribe = offlineManager.subscribe((actions) => {
      set({ actions });
    });
    set({ unsubscribe });
  },

  stopSyncWorker: () => {
    const unsubscribe = get().unsubscribe;
    if (unsubscribe) {
      unsubscribe();
      set({ unsubscribe: undefined });
    }
  },

  retryAction: async (id: string) => {
    await offlineManager.retryAction(id);
  },

  cancelAction: async (id: string) => {
    await offlineManager.cancelAction(id);
  },

  clearCompleted: async () => {
    await offlineManager.clearCompleted();
  },

  syncNow: async () => {
    if (get().syncing) return;
    set({ syncing: true });
    try {
      await offlineManager.manualSync();
      set({ lastSyncTime: Date.now() });
    } finally {
      set({ syncing: false });
    }
  },

  refreshStats: async () => {
    await offlineManager.queueStats();
  },
}));

export const useOfflineQueueStore = <T>(selector: (state: OfflineQueueState) => T): T =>
  useOfflineQueueStoreBase(selector as (state: OfflineQueueStore) => T);

const relay = <Args extends unknown[], Return>(
  selector: (store: OfflineQueueStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useOfflineQueueStoreBase.getState())(...args);
};

export const offlineQueueStore = {
  startSyncWorker: relay((store) => store.startSyncWorker),
  stopSyncWorker: relay((store) => store.stopSyncWorker),
  retryAction: relay((store) => store.retryAction),
  cancelAction: relay((store) => store.cancelAction),
  clearCompleted: relay((store) => store.clearCompleted),
  syncNow: relay((store) => store.syncNow),
  refreshStats: relay((store) => store.refreshStats),
  getState: () => useOfflineQueueStoreBase.getState(),
};
