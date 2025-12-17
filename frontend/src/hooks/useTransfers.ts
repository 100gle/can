import { showInfo, showWarning } from "@/lib/toast";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CancelTransferTask,
  ClearCompletedTransfers,
  DeleteTransferTask,
  DownloadBatch,
  GetTransferConfig,
  GetTransferSpeedLimit,
  ListTransferTasks,
  ListTransferTasksPaged,
  PauseTransferTask,
  ResumeTransferTask,
  SetTransferConcurrency,
  SetTransferSpeedLimit,
  UploadFilesFromPaths,
} from "@wailsjs/go/app/App";
import type { transfer } from "@wailsjs/go/models";

// --- Types ---

export type TaskStatus = "pending" | "running" | "paused" | "completed" | "failed" | "canceled";

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
  basePath?: string;
};

// --- Helpers ---

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

// --- Query Keys ---

export const TRANSFERS_KEYS = {
  all: ["transfers"] as const,
  lists: () => [...TRANSFERS_KEYS.all, "list"] as const,
  paged: (page: number, pageSize: number) =>
    [...TRANSFERS_KEYS.all, "paged", page, pageSize] as const,
  config: () => [...TRANSFERS_KEYS.all, "config"] as const,
  speedLimit: () => [...TRANSFERS_KEYS.all, "speedLimit"] as const,
};

// --- Hooks ---

export const useTransferTasks = () => {
  return useQuery<Record<string, TransferViewModel>>({
    queryKey: TRANSFERS_KEYS.lists(),
    queryFn: async () => {
      const result = await ListTransferTasks();
      const tasks: Record<string, TransferViewModel> = {};
      result.forEach((task) => {
        tasks[task.id] = toViewModel(task);
      });
      return tasks;
    },
    refetchInterval: 1000, // Poll every second
    staleTime: 500,
  });
};

export const useTransferTasksPaged = (page: number, pageSize: number, enabled = true) => {
  return useQuery({
    queryKey: TRANSFERS_KEYS.paged(page, pageSize),
    queryFn: async () => {
      const result = await ListTransferTasksPaged({ page, pageSize });
      const tasks: TransferViewModel[] = (result.tasks || []).map(toViewModel);
      return {
        tasks,
        total: result.total ?? tasks.length,
        totalPages: result.totalPages || 1,
      };
    },
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
    staleTime: 2000,
  });
};

export const useTransferStats = () => {
  const { data: tasks = {} } = useTransferTasks();
  const taskList = Object.values(tasks);
  const active = taskList.filter((t) => t.status === "running" || t.status === "pending").length;
  const failed = taskList.filter((t) => t.status === "failed").length;
  // We might want separate counts for uploads vs downloads if needed
  const uploads = taskList.filter((t) => t.type === "upload").length;
  const downloads = taskList.filter((t) => t.type === "download").length;
  return { active, failed, total: taskList.length, uploads, downloads };
};

export const useUploadFiles = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ filePaths, options }: { filePaths: string[]; options: UploadOptions }) => {
      const { accountId, bucket, prefix, basePath } = options;
      if (!accountId || !bucket) throw new Error("Please select account and bucket");
      if (!filePaths.length) throw new Error("No files selected");

      const result = await UploadFilesFromPaths({
        accountId,
        bucket,
        prefix: prefix || "",
        filePaths,
        basePath: basePath || "",
      });

      if ((result.failed?.length || 0) > 0) {
        throw new Error(`Failed to upload ${result.failed.length} files`);
      }
      return result.tasks?.length || 0;
    },
    onSuccess: (count: number) => {
      showInfo(`Added ${count} files to upload queue`);
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEYS.all });
    },
    onError: (err: unknown) => {
      showWarning(err instanceof Error ? err.message : "Upload failed");
    },
  });
};

export const useDownloadFiles = () => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { keys: string[]; options: UploadOptions }>({
    mutationFn: async ({ keys, options }) => {
      const { accountId, bucket } = options;
      if (!accountId || !bucket) throw new Error("Please select account and bucket");
      if (!keys.length) throw new Error("No files selected");

      const entries = keys.map((key) => ({
        bucket,
        key,
        relativePath: key,
        size: 0,
        versionId: "",
        isDir: key.endsWith("/"),
      }));

      await DownloadBatch(accountId, {
        bucket,
        entries,
        targetDirectory: "",
        archiveName: "",
        conflictStrategy: "rename",
      } as any);
    },
    onSuccess: (_: void, { keys }: { keys: string[] }) => {
      showInfo(`Added ${keys.length} files to download queue`);
      queryClient.invalidateQueries({ queryKey: TRANSFERS_KEYS.all });
    },
    onError: (err: unknown) => {
      showWarning(err instanceof Error ? err.message : "Download failed");
    },
  });
};

export const useTransferActions = () => {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: TRANSFERS_KEYS.all });

  const pause = useMutation({
    mutationFn: async (taskId: string) => {
      await PauseTransferTask(taskId);
    },
    onSuccess: invalidate,
  });

  const resume = useMutation({
    mutationFn: async (taskId: string) => {
      await ResumeTransferTask(taskId);
    },
    onSuccess: invalidate,
  });

  const cancel = useMutation({
    mutationFn: async (taskId: string) => {
      await CancelTransferTask(taskId);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (taskId: string) => {
      await DeleteTransferTask(taskId);
    },
    onSuccess: invalidate,
  });

  const clearCompleted = useMutation({
    mutationFn: async () => {
      await ClearCompletedTransfers();
    },
    onSuccess: invalidate,
  });

  return {
    pause: pause.mutate,
    resume: resume.mutate,
    cancel: cancel.mutate,
    remove: remove.mutate,
    clearCompleted: clearCompleted.mutate,
  };
};

// --- Config Hooks ---

export const useTransferConfig = () => {
  return useQuery({
    queryKey: TRANSFERS_KEYS.config(),
    queryFn: async () => {
      const [config, limit] = await Promise.all([GetTransferConfig(), GetTransferSpeedLimit()]);
      return { workerCount: config.workerCount, speedLimit: limit };
    },
    staleTime: 5000,
  });
};

export const useUpdateTransferConfig = () => {
  const queryClient = useQueryClient();

  const setWorkerCount = useMutation({
    mutationFn: async (count: number) => {
      await SetTransferConcurrency(count);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSFERS_KEYS.config() }),
  });

  const setSpeedLimit = useMutation({
    mutationFn: async (limit: number) => {
      await SetTransferSpeedLimit(limit);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRANSFERS_KEYS.config() }),
  });

  return {
    setWorkerCount: setWorkerCount.mutate,
    setSpeedLimit: setSpeedLimit.mutate,
  };
};
