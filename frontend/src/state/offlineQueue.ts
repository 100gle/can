import { isBridgeAvailable } from "@/lib/bridge";
import {
  addToQueue,
  clearCompleted as clearCompletedQueue,
  deleteAction,
  getAllActions,
  getPendingActions,
  incrementRetries,
  type QueuedAction,
  updateActionStatus,
} from "@/lib/offline-queue";
import { useAppStatusStore } from "@/state/appStatus";
import {
  DeleteObjectWithOptions,
  MoveObjectsWithOptions,
  RenameObjectWithOptions,
  UploadObject,
} from "@wailsjs/go/app/App";
import type { objects } from "@wailsjs/go/models";
import { create } from "zustand";

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
const SYNC_POLL_INTERVAL = 5000; // Check for work every 5s when online

type OfflineQueueState = {
  actions: QueuedAction[];
  syncing: boolean;
  lastSyncTime: number | null;
  syncTimer?: number;
};

type OfflineQueueActions = {
  loadQueue: () => Promise<void>;
  enqueueUpload: (
    accountId: string,
    bucket: string,
    key: string,
    filePath: string,
  ) => Promise<string>;
  enqueueDelete: (accountId: string, bucket: string, key: string) => Promise<string>;
  enqueueRename: (
    accountId: string,
    bucket: string,
    oldKey: string,
    newKey: string,
  ) => Promise<string>;
  enqueueMove: (accountId: string, requests: objects.MoveObjectRequest[]) => Promise<string>;
  retryAction: (id: string) => Promise<void>;
  cancelAction: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
  startSyncWorker: () => void;
  stopSyncWorker: () => void;
  syncNow: () => Promise<void>;
};

type OfflineQueueStore = OfflineQueueState & OfflineQueueActions;

const useOfflineQueueStoreBase = create<OfflineQueueStore>((set, get) => ({
  actions: [],
  syncing: false,
  lastSyncTime: null,
  syncTimer: undefined,

  loadQueue: async () => {
    const actions = await getAllActions();
    set({ actions });
  },

  enqueueUpload: async (accountId, bucket, key, filePath) => {
    const id = await addToQueue({
      accountId,
      bucket,
      type: "upload",
      payload: { key, filePath },
    });
    await get().loadQueue();
    return id;
  },

  enqueueDelete: async (accountId, bucket, key) => {
    const id = await addToQueue({
      accountId,
      bucket,
      type: "delete",
      payload: { key },
    });
    await get().loadQueue();
    return id;
  },

  enqueueRename: async (accountId, bucket, oldKey, newKey) => {
    const id = await addToQueue({
      accountId,
      bucket,
      type: "rename",
      payload: { oldKey, newKey },
    });
    await get().loadQueue();
    return id;
  },

  enqueueMove: async (accountId, requests) => {
    const id = await addToQueue({
      accountId,
      bucket: requests[0]?.sourceBucket || "",
      type: "move",
      payload: { requests },
    });
    await get().loadQueue();
    return id;
  },

  retryAction: async (id: string) => {
    await updateActionStatus(id, "pending");
    await get().loadQueue();
    void get().syncNow();
  },

  cancelAction: async (id: string) => {
    await deleteAction(id);
    await get().loadQueue();
  },

  clearCompleted: async () => {
    await clearCompletedQueue();
    await get().loadQueue();
  },

  startSyncWorker: () => {
    const timer = get().syncTimer;
    if (timer) return;

    // Listen to network status changes
    const unsubscribe = useAppStatusStore.subscribe((state, prevState) => {
      if (!prevState.isOnline && state.isOnline) {
        // Network just came back online
        void get().syncNow();
      }
    });

    // Periodic sync check
    const interval = window.setInterval(() => {
      const { isOnline } = useAppStatusStore.getState();
      if (isOnline) {
        void get().syncNow();
      }
    }, SYNC_POLL_INTERVAL);

    set({ syncTimer: interval });

    // Initial sync if online
    const { isOnline } = useAppStatusStore.getState();
    if (isOnline) {
      void get().syncNow();
    }

    return () => {
      unsubscribe();
      if (interval) {
        clearInterval(interval);
      }
    };
  },

  stopSyncWorker: () => {
    const timer = get().syncTimer;
    if (timer) {
      clearInterval(timer);
      set({ syncTimer: undefined });
    }
  },

  syncNow: async () => {
    if (get().syncing) return;
    if (!isBridgeAvailable()) return;

    const { isOnline } = useAppStatusStore.getState();
    if (!isOnline) return;

    set({ syncing: true });

    try {
      const pending = await getPendingActions();

      for (const action of pending) {
        try {
          await updateActionStatus(action.id, "running");
          await get().loadQueue();

          await executeAction(action);

          await updateActionStatus(action.id, "completed");
          await get().loadQueue();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          const retries = await incrementRetries(action.id);

          if (retries >= MAX_RETRIES) {
            await updateActionStatus(action.id, "failed", `Max retries exceeded: ${message}`);
          } else {
            await updateActionStatus(action.id, "pending", message);
            // Wait before retrying (exponential backoff)
            const delay = RETRY_DELAYS[Math.min(retries - 1, RETRY_DELAYS.length - 1)];
            await new Promise((resolve) => setTimeout(resolve, delay));
          }

          await get().loadQueue();
        }
      }

      set({ lastSyncTime: Date.now() });
    } finally {
      set({ syncing: false });
    }
  },
}));

async function executeAction(action: QueuedAction): Promise<void> {
  const requestId = action.id;
  const options: objects.MutationOptions = {
    requestId,
    origin: "offline-queue",
  };

  switch (action.type) {
    case "upload": {
      const { key, filePath } = action.payload as { key: string; filePath: string };
      await UploadObject(action.accountId, action.bucket, key, filePath);
      break;
    }
    case "delete": {
      const { key } = action.payload as { key: string };
      await DeleteObjectWithOptions(action.accountId, action.bucket, key, options);
      break;
    }
    case "rename": {
      const { oldKey, newKey } = action.payload as { oldKey: string; newKey: string };
      await RenameObjectWithOptions(action.accountId, action.bucket, oldKey, newKey, options);
      break;
    }
    case "move": {
      const { requests } = action.payload as { requests: objects.MoveObjectRequest[] };
      await MoveObjectsWithOptions(action.accountId, requests, options);
      break;
    }
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

export const useOfflineQueueStore = <T>(selector: (state: OfflineQueueState) => T): T =>
  useOfflineQueueStoreBase(selector as (state: OfflineQueueStore) => T);

const relay = <Args extends unknown[], Return>(
  selector: (store: OfflineQueueStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useOfflineQueueStoreBase.getState())(...args);
};

export const offlineQueueStore = {
  loadQueue: relay((store) => store.loadQueue),
  enqueueUpload: relay((store) => store.enqueueUpload),
  enqueueDelete: relay((store) => store.enqueueDelete),
  enqueueRename: relay((store) => store.enqueueRename),
  enqueueMove: relay((store) => store.enqueueMove),
  retryAction: relay((store) => store.retryAction),
  cancelAction: relay((store) => store.cancelAction),
  clearCompleted: relay((store) => store.clearCompleted),
  startSyncWorker: relay((store) => store.startSyncWorker),
  stopSyncWorker: relay((store) => store.stopSyncWorker),
  syncNow: relay((store) => store.syncNow),
  getState: () => useOfflineQueueStoreBase.getState(),
};
