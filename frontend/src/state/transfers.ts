import { isBridgeAvailable } from "@/lib/bridge";
import {
  AbortMultipartUpload,
  CancelTransferTask,
  CompleteMultipartUpload,
  InitiateMultipartUpload,
  ListTransferTasks,
  PauseTransferTask,
  ResumeTransferTask,
  UploadPart,
} from "@wailsjs/go/main/App";
import type { transfer } from "@wailsjs/go/models";
import { create } from "zustand";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const BACKEND_POLL_INTERVAL = 5000;

type TaskStatus = "pending" | "running" | "paused" | "completed" | "failed" | "canceled";

export type TransferViewModel = {
  id: string;
  accountId: string;
  bucket: string;
  key: string;
  name: string;
  type: "upload" | "download";
  status: TaskStatus;
  progress: number;
  total: number;
  speed?: number;
  eta?: number;
  source: "local" | "backend";
  uploadId?: string;
  error?: string;
};

type UploadOptions = {
  accountId?: string;
  bucket?: string;
  prefix?: string;
};

type TransfersState = {
  tasks: Record<string, TransferViewModel>;
  uploading: boolean;
  error?: string;
  pollTimer?: number;
};

type TransfersActions = {
  startPolling: () => void;
  stopPolling: () => void;
  syncBackendTasks: () => Promise<void>;
  uploadFiles: (files: File[], options: UploadOptions) => Promise<void>;
  downloadFiles: (keys: string[], options: UploadOptions) => Promise<void>;
  pauseTask: (taskID: string) => Promise<void>;
  resumeTask: (taskID: string) => Promise<void>;
  cancelTask: (taskID: string) => Promise<void>;
  clearCompleted: () => void;
};

type TransfersStore = TransfersState & TransfersActions;

type LocalTaskRuntime = {
  file: File;
  accountId: string;
  bucket: string;
  key: string;
  uploadId?: string;
  completedParts: Record<number, string>;
  controller: {
    paused: boolean;
    canceled: boolean;
  };
  startedAt: number;
};

const localRuntimes = new Map<string, LocalTaskRuntime>();

const normalizePrefix = (prefix?: string) => {
  if (!prefix) return "";
  return prefix.replace(/^\/+/, "").replace(/\/+$/, "");
};

const buildObjectKey = (prefix: string | undefined, relativePath: string) => {
  const cleanPrefix = normalizePrefix(prefix);
  const cleanPath = relativePath.replace(/^\/+/, "");
  return cleanPrefix ? `${cleanPrefix}/${cleanPath}` : cleanPath;
};

const deriveName = (key: string) => {
  const segments = key.split("/").filter(Boolean);
  return segments.pop() || key;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toViewModel = (task: transfer.TransferTask): TransferViewModel => ({
  id: task.id,
  accountId: task.accountId,
  bucket: task.bucket,
  key: task.key,
  name: deriveName(task.key),
  type: task.type === "download" ? "download" : "upload",
  status: (task.status as TaskStatus) || "pending",
  progress: task.progress || 0,
  total: task.total || 0,
  speed: task.speed || undefined,
  eta: task.estimatedTime || undefined,
  source: "backend",
  uploadId: task.uploadId || undefined,
  error: task.error || undefined,
});

const createInitialState = (): TransfersState => ({
  tasks: {},
  uploading: false,
});

const waitForResume = async (runtime: LocalTaskRuntime) => {
  while (runtime.controller.paused && !runtime.controller.canceled) {
    await delay(250);
  }
  if (runtime.controller.canceled) {
    throw new Error("transfer canceled");
  }
};

const updateSpeedHints = (
  runtime: LocalTaskRuntime,
  task: TransferViewModel,
): TransferViewModel => {
  const elapsedSeconds = (Date.now() - runtime.startedAt) / 1000;
  if (elapsedSeconds > 0 && task.progress > 0) {
    const speed = Math.round(task.progress / elapsedSeconds);
    const remaining = Math.max(task.total - task.progress, 0);
    const eta = speed > 0 ? Math.ceil(remaining / speed) : undefined;
    return { ...task, speed, eta };
  }
  return task;
};

const useTransfersStoreBase = create<TransfersStore>((set, get) => ({
  ...createInitialState(),
  startPolling: () => {
    if (!isBridgeAvailable()) return;
    const timer = get().pollTimer;
    if (timer) return;
    const handle = window.setInterval(() => {
      void get().syncBackendTasks();
    }, BACKEND_POLL_INTERVAL);
    set({ pollTimer: handle });
    void get().syncBackendTasks();
  },
  stopPolling: () => {
    const timer = get().pollTimer;
    if (timer) {
      window.clearInterval(timer);
      set({ pollTimer: undefined });
    }
  },
  syncBackendTasks: async () => {
    if (!isBridgeAvailable()) return;
    try {
      const result = await ListTransferTasks();
      set((state) => {
        const updates = { ...state.tasks };
        result.forEach((task) => {
          updates[task.id] = toViewModel(task);
        });
        return { tasks: updates };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步传输任务失败";
      set({ error: message });
    }
  },
  uploadFiles: async (files, options) => {
    const { accountId, bucket, prefix } = options;
    if (!accountId || !bucket) {
      window.alert?.("请选择账户与 Bucket 后再上传文件");
      return;
    }
    if (!files.length) return;
    set({ uploading: true, error: undefined });
    try {
      for (const file of files) {
        const relative = file.webkitRelativePath || file.name;
        const key = buildObjectKey(prefix, relative);
        const taskID = crypto.randomUUID();
        const runtime: LocalTaskRuntime = {
          file,
          accountId,
          bucket,
          key,
          completedParts: {},
          controller: { paused: false, canceled: false },
          startedAt: Date.now(),
        };
        localRuntimes.set(taskID, runtime);
        set((state) => ({
          tasks: {
            ...state.tasks,
            [taskID]: {
              id: taskID,
              accountId,
              bucket,
              key,
              name: file.name,
              type: "upload",
              status: "pending",
              progress: 0,
              total: file.size,
              source: "local",
            },
          },
        }));
        void processUploadTask(taskID, runtime, set);
      }
    } finally {
      set({ uploading: false });
    }
  },
  downloadFiles: async () => {
    window.alert?.("批量下载尚未实现，敬请期待。");
  },
  pauseTask: async (taskID: string) => {
    const runtime = localRuntimes.get(taskID);
    if (runtime) {
      runtime.controller.paused = true;
      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskID]: { ...state.tasks[taskID], status: "paused" },
        },
      }));
      return;
    }
    if (!isBridgeAvailable()) return;
    await PauseTransferTask(taskID);
    void get().syncBackendTasks();
  },
  resumeTask: async (taskID: string) => {
    const runtime = localRuntimes.get(taskID);
    if (runtime) {
      runtime.controller.paused = false;
      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskID]: { ...state.tasks[taskID], status: "running" },
        },
      }));
      return;
    }
    if (!isBridgeAvailable()) return;
    await ResumeTransferTask(taskID);
    void get().syncBackendTasks();
  },
  cancelTask: async (taskID: string) => {
    const runtime = localRuntimes.get(taskID);
    if (runtime) {
      runtime.controller.canceled = true;
      try {
        if (runtime.uploadId) {
          await AbortMultipartUpload(
            runtime.accountId,
            runtime.bucket,
            runtime.key,
            runtime.uploadId,
          );
        }
      } catch (error) {
        console.error(error);
      }
      set((state) => ({
        tasks: {
          ...state.tasks,
          [taskID]: { ...state.tasks[taskID], status: "canceled" },
        },
      }));
      localRuntimes.delete(taskID);
      return;
    }
    if (!isBridgeAvailable()) return;
    await CancelTransferTask(taskID);
    void get().syncBackendTasks();
  },
  clearCompleted: () => {
    set((state) => {
      const next: Record<string, TransferViewModel> = {};
      Object.values(state.tasks).forEach((task) => {
        if (task.status === "completed") {
          return;
        }
        next[task.id] = task;
      });
      return { tasks: next };
    });
  },
}));

const processUploadTask = async (
  taskID: string,
  runtime: LocalTaskRuntime,
  set: (fn: (state: TransfersState) => Partial<TransfersState>) => void,
) => {
  try {
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskID]: { ...state.tasks[taskID], status: "running" },
      },
    }));
    const uploadId = await InitiateMultipartUpload(runtime.accountId, runtime.bucket, runtime.key);
    runtime.uploadId = uploadId;
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskID]: { ...state.tasks[taskID], uploadId },
      },
    }));
    let partNumber = 1;
    for (let offset = 0; offset < runtime.file.size; offset += CHUNK_SIZE, partNumber += 1) {
      await waitForResume(runtime);
      const chunk = runtime.file.slice(offset, Math.min(offset + CHUNK_SIZE, runtime.file.size));
      const buffer = await chunk.arrayBuffer();
      const payload = new Uint8Array(buffer);
      const etag = await UploadPart(
        runtime.accountId,
        runtime.bucket,
        runtime.key,
        uploadId,
        partNumber,
        payload as unknown as number[],
      );
      runtime.completedParts[partNumber] = etag;
      set((state) => {
        const current = state.tasks[taskID];
        if (!current) {
          return {};
        }
        const nextProgress = Math.min(current.progress + payload.byteLength, current.total);
        const updated = updateSpeedHints(runtime, {
          ...current,
          progress: nextProgress,
        });
        return {
          tasks: {
            ...state.tasks,
            [taskID]: updated,
          },
        };
      });
    }
    await CompleteMultipartUpload(
      runtime.accountId,
      runtime.bucket,
      runtime.key,
      uploadId,
      runtime.completedParts,
    );
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskID]: {
          ...state.tasks[taskID],
          status: "completed",
          progress: runtime.file.size,
          eta: 0,
          speed: 0,
        },
      },
    }));
    localRuntimes.delete(taskID);
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    const canceled = runtime.controller.canceled || message.includes("canceled");
    if (runtime.uploadId && !canceled) {
      try {
        await AbortMultipartUpload(
          runtime.accountId,
          runtime.bucket,
          runtime.key,
          runtime.uploadId,
        );
      } catch (abortErr) {
        console.error(abortErr);
      }
    }
    set((state) => ({
      tasks: {
        ...state.tasks,
        [taskID]: {
          ...state.tasks[taskID],
          status: canceled ? "canceled" : "failed",
          error: canceled ? "用户已取消上传" : message,
        },
      },
    }));
    localRuntimes.delete(taskID);
  }
};

export const useTransfersStore = <T>(selector: (state: TransfersState) => T): T =>
  useTransfersStoreBase(selector as (state: TransfersStore) => T);

const relay = <Args extends unknown[], Return>(
  selector: (store: TransfersStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useTransfersStoreBase.getState())(...args);
};

export const transfersStore = {
  startPolling: relay((store) => store.startPolling),
  stopPolling: relay((store) => store.stopPolling),
  syncBackendTasks: relay((store) => store.syncBackendTasks),
  uploadFiles: relay((store) => store.uploadFiles),
  downloadFiles: relay((store) => store.downloadFiles),
  pauseTask: relay((store) => store.pauseTask),
  resumeTask: relay((store) => store.resumeTask),
  cancelTask: relay((store) => store.cancelTask),
  clearCompleted: relay((store) => store.clearCompleted),
};
