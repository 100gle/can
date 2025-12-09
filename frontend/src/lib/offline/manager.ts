import { isDesktopMode } from "@/lib/bridge";
import { offlineCache } from "@/lib/offline/cache";
import {
  addAction,
  clearCompleted,
  configureOfflineQueue,
  deleteAction,
  getAllActions,
  getPendingActions,
  getQueueStats,
  incrementRetries,
  purgeExpiredActions,
  updateActionStatus,
} from "@/lib/offline/queue";
import type {
  OfflineAction,
  OfflineActionExecution,
  OfflineActionInput,
} from "@/lib/offline/types";
import { useAppStatusStore } from "@/state/appStatus";
import { transfersStore } from "@/state/transfers";
import {
  CreateFolder,
  DeleteObjectWithOptions,
  MoveObjectsWithOptions,
  RenameObjectWithOptions,
  UploadObject,
} from "@wailsjs/go/app/App";
import type { buckets, objects } from "@wailsjs/go/models";

type BucketInfo = buckets.BucketInfo;
type ObjectInfo = objects.ObjectInfo;

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];
const MAX_RETRIES = RETRY_DELAYS.length;

type ListObjectsLoader = () => Promise<{
  items: ObjectInfo[];
  truncated: boolean;
  nextMarker?: string;
}>;

type ListBucketsLoader = () => Promise<BucketInfo[]>;

type FileContentLoader = () => Promise<{
  content: string;
  contentType: string;
  etag?: string;
}>;

type QueueListener = (actions: OfflineAction[]) => void;

export class OfflineManager {
  private queueListeners = new Set<QueueListener>();
  private syncing = false;
  private activeAccountId?: string;

  constructor() {
    useAppStatusStore.subscribe((state, prevState) => {
      if (!prevState.isOnline && state.isOnline) {
        void this.flushPending();
      }
    });
  }

  configure(options: { cacheSizeMB?: number; queueMaxItems?: number; queueTTLHours?: number }) {
    if (options.cacheSizeMB) {
      offlineCache.configure({ sizeLimitBytes: options.cacheSizeMB * 1024 * 1024 });
    }
    if (options.queueMaxItems || options.queueTTLHours) {
      configureOfflineQueue({
        maxItems: options.queueMaxItems,
        actionTTL: (options.queueTTLHours ?? 72) * 60 * 60 * 1000,
      });
    }
  }

  setActiveAccount(accountId?: string) {
    this.activeAccountId = accountId;
  }

  subscribe(listener: QueueListener) {
    this.queueListeners.add(listener);
    void this.emitQueueSnapshot();
    return () => {
      this.queueListeners.delete(listener);
    };
  }

  private async emitQueueSnapshot() {
    const actions = await getAllActions();
    this.queueListeners.forEach((listener) => listener(actions));
  }

  private isOnline() {
    const { isOnline } = useAppStatusStore.getState();
    return isOnline && isDesktopMode();
  }

  async listBuckets(accountId: string, loader: ListBucketsLoader) {
    try {
      const items = await loader();
      await offlineCache.setBucketList(accountId, items);
      return { items, source: "network" as const, lastSyncedAt: Date.now() };
    } catch (error) {
      const cached = await offlineCache.getBucketList(accountId);
      if (cached) {
        return {
          items: cached.items,
          source: "cache" as const,
          lastSyncedAt: cached.lastSyncedAt,
          versionToken: cached.versionToken,
        };
      }
      throw error;
    }
  }

  async listObjects(
    params: { accountId: string; bucket: string; prefix: string; delimiter: string },
    loader: ListObjectsLoader,
  ) {
    const { accountId, bucket, prefix, delimiter } = params;
    try {
      const payload = await loader();
      await offlineCache.setObjectList({
        accountId,
        bucket,
        prefix,
        delimiter,
        items: payload.items,
        truncated: payload.truncated,
        nextMarker: payload.nextMarker,
      });
      return {
        items: payload.items,
        truncated: payload.truncated,
        nextMarker: payload.nextMarker,
        source: "network" as const,
        lastSyncedAt: Date.now(),
      };
    } catch (error) {
      const cached = await offlineCache.getObjectList(accountId, bucket, prefix, delimiter);
      if (cached) {
        return {
          items: cached.items,
          truncated: cached.truncated,
          nextMarker: cached.nextMarker,
          source: "cache" as const,
          lastSyncedAt: cached.lastSyncedAt,
          versionToken: cached.versionToken,
        };
      }
      throw error;
    }
  }

  async getFileContent(
    params: { accountId: string; bucket: string; key: string },
    loader: FileContentLoader,
  ) {
    const { accountId, bucket, key } = params;
    try {
      const payload = await loader();
      await offlineCache.setFileContent({
        accountId,
        bucket,
        key,
        content: payload.content,
        contentType: payload.contentType,
        etag: payload.etag,
      });
      return {
        content: payload.content,
        contentType: payload.contentType,
        etag: payload.etag,
        source: "network" as const,
        lastSyncedAt: Date.now(),
      };
    } catch (error) {
      const cached = await offlineCache.getFileContent(accountId, bucket, key);
      if (cached) {
        return {
          content: cached.content,
          contentType: cached.contentType,
          etag: cached.etag,
          source: "cache" as const,
          lastSyncedAt: cached.lastSyncedAt,
        };
      }
      throw error;
    }
  }

  async uploadObject(params: {
    accountId: string;
    bucket: string;
    key: string;
    filePath: string;
    versionToken?: string;
  }): Promise<OfflineActionExecution<void>> {
    const { accountId, bucket, key, filePath, versionToken } = params;
    return this.executeOrQueue(
      {
        accountId,
        bucket,
        type: "upload",
        payload: { key, filePath },
        versionToken,
      },
      async () => {
        const task = await UploadObject(accountId, bucket, key, filePath);
        if (task?.id) {
          transfersStore.syncBackendTasks();
        }
      },
    );
  }

  async deleteObject(params: {
    accountId: string;
    bucket: string;
    key: string;
    versionToken?: string;
  }): Promise<OfflineActionExecution<void>> {
    const { accountId, bucket, key, versionToken } = params;
    return this.executeOrQueue(
      {
        accountId,
        bucket,
        type: "delete",
        payload: { key },
        versionToken,
      },
      () => {
        const options: objects.MutationOptions = {
          requestId: crypto.randomUUID(),
          origin: "offline-queue",
        };
        return DeleteObjectWithOptions(accountId, bucket, key, options);
      },
    );
  }

  async renameObject(params: {
    accountId: string;
    bucket: string;
    oldKey: string;
    newKey: string;
    versionToken?: string;
  }): Promise<OfflineActionExecution<void>> {
    const { accountId, bucket, oldKey, newKey, versionToken } = params;
    return this.executeOrQueue(
      {
        accountId,
        bucket,
        type: "rename",
        payload: { oldKey, newKey },
        versionToken,
      },
      () => {
        const options: objects.MutationOptions = {
          requestId: crypto.randomUUID(),
          origin: "offline-queue",
        };
        return RenameObjectWithOptions(accountId, bucket, oldKey, newKey, options);
      },
    );
  }

  async moveObjects(params: {
    accountId: string;
    requests: objects.MoveObjectRequest[];
    versionToken?: string;
  }): Promise<OfflineActionExecution<objects.MoveObjectsResult>> {
    const { accountId, requests, versionToken } = params;
    const bucket = requests[0]?.sourceBucket ?? "";
    return this.executeOrQueue(
      {
        accountId,
        bucket,
        type: "move",
        payload: { requests },
        versionToken,
      },
      () => {
        const options: objects.MutationOptions = {
          requestId: crypto.randomUUID(),
          origin: "offline-queue",
        };
        return MoveObjectsWithOptions(accountId, requests, options);
      },
    );
  }

  async createFolder(params: {
    accountId: string;
    bucket: string;
    key: string;
    versionToken?: string;
  }): Promise<OfflineActionExecution<void>> {
    const { accountId, bucket, key, versionToken } = params;
    return this.executeOrQueue(
      {
        accountId,
        bucket,
        type: "create-folder",
        payload: { key },
        versionToken,
      },
      () => CreateFolder(accountId, bucket, key),
    );
  }

  async manualSync() {
    await this.flushPending();
  }

  async retryAction(id: string) {
    await updateActionStatus(id, "pending");
    await this.emitQueueSnapshot();
    await this.flushPending();
  }

  async cancelAction(id: string) {
    await deleteAction(id);
    await this.emitQueueSnapshot();
  }

  async clearCompleted() {
    await clearCompleted();
    await this.emitQueueSnapshot();
  }

  async queueStats() {
    return getQueueStats();
  }

  private async executeOrQueue<T>(
    input: OfflineActionInput,
    executor: () => Promise<T>,
  ): Promise<OfflineActionExecution<T>> {
    await purgeExpiredActions();

    if (this.isOnline()) {
      const result = await executor();
      return { status: "executed", result };
    }

    const actionId = await addAction(input);
    await this.emitQueueSnapshot();
    return { status: "queued", actionId };
  }

  private async flushPending() {
    if (this.syncing || !this.isOnline()) {
      return;
    }
    this.syncing = true;
    try {
      await purgeExpiredActions();
      const pending = await getPendingActions(this.activeAccountId);
      for (const action of pending) {
        await updateActionStatus(action.id, "running");
        await this.emitQueueSnapshot();
        try {
          await this.executeAction(action);
          await updateActionStatus(action.id, "completed");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          const retries = await incrementRetries(action.id);
          if (retries >= MAX_RETRIES) {
            await updateActionStatus(action.id, "failed", message);
          } else {
            await updateActionStatus(action.id, "pending", message);
            const delay = RETRY_DELAYS[Math.min(retries - 1, RETRY_DELAYS.length - 1)];
            await this.delay(delay);
          }
        }
        await this.emitQueueSnapshot();
      }
    } finally {
      this.syncing = false;
    }
  }

  private async executeAction(action: OfflineAction) {
    switch (action.type) {
      case "upload": {
        const { key, filePath } = action.payload as { key: string; filePath: string };
        await UploadObject(action.accountId, action.bucket, key, filePath);
        return;
      }
      case "delete": {
        const { key } = action.payload as { key: string };
        const options: objects.MutationOptions = {
          requestId: action.id,
          origin: "offline-queue",
        };
        await DeleteObjectWithOptions(action.accountId, action.bucket, key, options);
        return;
      }
      case "rename": {
        const { oldKey, newKey } = action.payload as { oldKey: string; newKey: string };
        const options: objects.MutationOptions = {
          requestId: action.id,
          origin: "offline-queue",
        };
        await RenameObjectWithOptions(action.accountId, action.bucket, oldKey, newKey, options);
        return;
      }
      case "move": {
        const { requests } = action.payload as { requests: objects.MoveObjectRequest[] };
        const options: objects.MutationOptions = {
          requestId: action.id,
          origin: "offline-queue",
        };
        await MoveObjectsWithOptions(action.accountId, requests, options);
        return;
      }
      case "create-folder": {
        const { key } = action.payload as { key: string };
        await CreateFolder(action.accountId, action.bucket, key);
        return;
      }
      default:
        throw new Error(`Unsupported offline action: ${action.type}`);
    }
  }

  private async delay(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const offlineManager = new OfflineManager();
