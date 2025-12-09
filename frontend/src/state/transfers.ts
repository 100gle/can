/**
 * Transfer Queue Store
 *
 * Backend-only transfer management for desktop app.
 * All uploads and downloads go through the Go backend for proper progress tracking,
 * speed limiting, persistence, and pause/resume capabilities.
 */

import { isDesktopMode } from "@/lib/bridge";
import { showInfo, showWarning } from "@/lib/toast";
import {
  CancelTransferTask,
  ClearCompletedTransfers,
  DeleteTransferTask,
  DownloadBatch,
  GetTransferConfig,
  GetTransferSpeedLimit,
  ListTransferTasks,
  PauseTransferTask,
  ResumeTransferTask,
  SetTransferConcurrency,
  SetTransferSpeedLimit,
  UploadFilesFromPaths,
} from "@wailsjs/go/app/App";
import type { transfer } from "@wailsjs/go/models";
import { create } from "zustand";

const BACKEND_POLL_INTERVAL = 5000;

type TaskStatus = "pending" | "running" | "paused" | "completed" | "failed" | "canceled";

export type TransferViewModel = {
  id: string;
  accountId: string;
  bucket: string;
  key: string;
  localPath?: string;
  name: string;
  type: "upload" | "download";
  status: TaskStatus;
  progress: number;
  total: number;
  speed?: number;
  eta?: number;
  source: "backend";
  uploadId?: string;
  error?: string;
};

export type UploadOptions = {
  accountId?: string;
  bucket?: string;
  prefix?: string;
  basePath?: string; // For directory uploads, common base path to compute relative paths
};

type TransfersState = {
  tasks: Record<string, TransferViewModel>;
  uploading: boolean;
  globalSpeedLimit: number; // bytes per second, 0 = unlimited
  workerCount: number;
  error?: string;
  pollTimer?: number;
};

type TransfersActions = {
  startPolling: () => void;
  stopPolling: () => void;
  syncBackendTasks: () => Promise<void>;
  uploadFilesFromPaths: (filePaths: string[], options: UploadOptions) => Promise<void>;
  downloadFiles: (keys: string[], options: UploadOptions) => Promise<void>;
  pauseTask: (taskID: string) => Promise<void>;
  resumeTask: (taskID: string) => Promise<void>;
  cancelTask: (taskID: string) => Promise<void>;
  deleteTask: (taskID: string) => void;
  clearCompleted: () => void;
  // Speed Limit
  loadGlobalSpeedLimit: () => Promise<void>;
  setGlobalSpeedLimit: (bytesPerSec: number) => Promise<void>;
  // Concurrency
  loadConfig: () => Promise<void>;
  setWorkerCount: (count: number) => Promise<void>;
};

type TransfersStore = TransfersState & TransfersActions;

const deriveName = (key: string) => {
  const segments = key.split("/").filter(Boolean);
  return segments.pop() || key;
};

const toViewModel = (task: transfer.TransferTask): TransferViewModel => ({
  id: task.id,
  accountId: task.accountId,
  bucket: task.bucket,
  key: task.key,
  localPath: task.localPath || undefined,
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
  globalSpeedLimit: 0,
  workerCount: 2,
});

const useTransfersStoreBase = create<TransfersStore>((set, get) => ({
  ...createInitialState(),

  startPolling: () => {
    if (!isDesktopMode()) return;
    const timer = get().pollTimer;
    if (timer) return;
    const handle = window.setInterval(() => {
      void get().syncBackendTasks();
    }, BACKEND_POLL_INTERVAL);
    set({ pollTimer: handle });
    void get().syncBackendTasks();
    void get().loadConfig();
  },

  stopPolling: () => {
    const timer = get().pollTimer;
    if (timer) {
      window.clearInterval(timer);
      set({ pollTimer: undefined });
    }
  },

  syncBackendTasks: async () => {
    if (!isDesktopMode()) return;
    try {
      const result = await ListTransferTasks();
      // Backend is the sole source of truth
      const tasks: Record<string, TransferViewModel> = {};
      result.forEach((task) => {
        tasks[task.id] = toViewModel(task);
      });
      set({ tasks });
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步传输任务失败";
      set({ error: message });
    }
  },

  uploadFilesFromPaths: async (filePaths: string[], options: UploadOptions) => {
    const { accountId, bucket, prefix } = options;
    if (!accountId || !bucket) {
      showWarning("请选择账户与 Bucket 后再上传文件");
      return;
    }
    if (!filePaths.length) {
      showWarning("请选择要上传的文件");
      return;
    }

    if (!isDesktopMode()) {
      showWarning("上传功能仅在桌面模式下可用");
      return;
    }

    set({ uploading: true, error: undefined });
    try {
      const result = await UploadFilesFromPaths({
        accountId,
        bucket,
        prefix: prefix || "",
        filePaths,
        basePath: options.basePath || "",
      });

      if (result.tasks && result.tasks.length > 0) {
        showInfo(`已添加 ${result.tasks.length} 个文件到上传队列`);
      }
      if (result.failed && result.failed.length > 0) {
        for (const fail of result.failed) {
          showWarning(`上传失败: ${fail.filePath} - ${fail.error}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "上传失败";
      showWarning(`添加上传任务失败: ${message}`);
    } finally {
      set({ uploading: false });
    }
  },

  downloadFiles: async (keys: string[], options: UploadOptions) => {
    const { accountId, bucket } = options;
    if (!accountId || !bucket) {
      showWarning("请选择账户与 Bucket 后再下载文件");
      return;
    }
    if (!keys.length) {
      showWarning("请选择要下载的文件");
      return;
    }

    if (!isDesktopMode()) {
      showWarning("下载功能仅在桌面模式下可用");
      return;
    }

    try {
      const entries = keys.map((key) => ({
        bucket,
        key,
        relativePath: key,
        size: 0,
        versionId: "",
        isDir: key.endsWith("/"),
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await DownloadBatch(accountId, {
        bucket,
        entries,
        targetDirectory: "",
        archiveName: "",
        conflictStrategy: "rename",
      } as any);
      showInfo(`已添加 ${keys.length} 个文件到下载队列`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "下载失败";
      showWarning(`添加下载任务失败: ${message}`);
    }
  },

  pauseTask: async (taskID: string) => {
    if (!isDesktopMode()) return;
    await PauseTransferTask(taskID);
    void get().syncBackendTasks();
  },

  resumeTask: async (taskID: string) => {
    if (!isDesktopMode()) return;
    await ResumeTransferTask(taskID);
    void get().syncBackendTasks();
  },

  cancelTask: async (taskID: string) => {
    if (!isDesktopMode()) return;
    await CancelTransferTask(taskID);
    void get().syncBackendTasks();
  },

  deleteTask: async (taskID: string) => {
    if (!isDesktopMode()) return;
    try {
      await DeleteTransferTask(taskID);
      void get().syncBackendTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除任务失败";
      set({ error: message });
    }
  },

  clearCompleted: async () => {
    if (!isDesktopMode()) return;
    try {
      await ClearCompletedTransfers();
      void get().syncBackendTasks();
    } catch (error) {
      const message = error instanceof Error ? error.message : "清理已完成任务失败";
      set({ error: message });
    }
  },

  loadGlobalSpeedLimit: async () => {
    if (!isDesktopMode()) return;
    try {
      const limit = await GetTransferSpeedLimit();
      set({ globalSpeedLimit: limit });
    } catch {
      // ignore
    }
  },

  setGlobalSpeedLimit: async (bytesPerSec: number) => {
    if (!isDesktopMode()) return;
    try {
      await SetTransferSpeedLimit(bytesPerSec);
      set({ globalSpeedLimit: bytesPerSec });
    } catch (error) {
      const message = error instanceof Error ? error.message : "设置限速失败";
      set({ error: message });
    }
  },

  loadConfig: async () => {
    if (!isDesktopMode()) return;
    try {
      const config = await GetTransferConfig();
      set({
        workerCount: config.workerCount,
        globalSpeedLimit: config.speedLimit,
      });
    } catch {
      // ignore
    }
  },

  setWorkerCount: async (count: number) => {
    if (!isDesktopMode()) return;
    try {
      await SetTransferConcurrency(count);
      set({ workerCount: count });
    } catch (error) {
      const message = error instanceof Error ? error.message : "设置并发数失败";
      set({ error: message });
    }
  },
}));

export const useTransfersStore = <T>(selector: (state: TransfersState) => T): T =>
  useTransfersStoreBase(selector as (state: TransfersStore) => T);

export const useTransferStats = () => {
  const tasks = useTransfersStore((state) => state.tasks);
  const taskList = Object.values(tasks);
  const active = taskList.filter((t) => t.status === "running" || t.status === "pending").length;
  const failed = taskList.filter((t) => t.status === "failed").length;
  const total = taskList.length;
  return { active, failed, total };
};

const relay = <Args extends unknown[], Return>(
  selector: (store: TransfersStore) => (...args: Args) => Return,
) => {
  return (...args: Args) => selector(useTransfersStoreBase.getState())(...args);
};

export const transfersStore = {
  startPolling: relay((store) => store.startPolling),
  stopPolling: relay((store) => store.stopPolling),
  syncBackendTasks: relay((store) => store.syncBackendTasks),
  uploadFilesFromPaths: relay((store) => store.uploadFilesFromPaths),
  downloadFiles: relay((store) => store.downloadFiles),
  pauseTask: relay((store) => store.pauseTask),
  resumeTask: relay((store) => store.resumeTask),
  cancelTask: relay((store) => store.cancelTask),
  deleteTask: relay((store) => store.deleteTask),
  clearCompleted: relay((store) => store.clearCompleted),
  loadGlobalSpeedLimit: relay((store) => store.loadGlobalSpeedLimit),
  setGlobalSpeedLimit: relay((store) => store.setGlobalSpeedLimit),
  loadConfig: relay((store) => store.loadConfig),
  setWorkerCount: relay((store) => store.setWorkerCount),
};
