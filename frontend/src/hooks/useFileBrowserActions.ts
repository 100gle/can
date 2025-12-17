/**
 * useFileBrowserActions
 *
 * File operation actions for the file browser.
 * Handles downloads, uploads, deletions, previews, and link copying.
 * Desktop-only: all uploads go through backend queue via file paths.
 */

import { useObjectMutations, type ObjectModel } from "@/hooks/useObjects";
import { TRANSFERS_KEYS, useUploadFiles } from "@/hooks/useTransfers";
import { saveFileDialog } from "@/lib/bridge";
import { logger } from "@/lib/logger";
import { useQueryClient } from "@tanstack/react-query";
import {
  DownloadObject,
  GetPresignedDownloadURL,
  OpenDirectoryDialogWithFiles,
  OpenMultipleFilesDialog,
} from "@wailsjs/go/app/App";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";

export interface FileActionState {
  pendingDeleteBucket: string | null;
  pendingDeleteObject: string | null;
  errorMessage: string;
  previewObject: ObjectModel | null;
  uploading: boolean;
}

export interface FileActionHandlers {
  // Download
  handleDownload: (key: string) => Promise<void>;
  handleCopyLink: (key: string) => Promise<void>;

  // Delete
  handleDeleteBucket: () => Promise<void>;
  handleDeleteObject: () => Promise<void>;
  handleDeleteSelected: (keys: string[]) => Promise<void>;
  setPendingDeleteBucket: (name: string | null) => void;
  setPendingDeleteObject: (key: string | null) => void;

  // Preview
  handlePreview: (key: string) => void;
  clearPreview: () => void;

  // Upload (Desktop only - uses Wails dialogs + backend queue)
  handleUploadClick: () => Promise<void>;
  handleUploadFolder: () => Promise<void>;

  // Dialogs
  reportError: (message: string) => void;
}

interface UseFileBrowserActionsOptions {
  accountId?: string;
  currentBucket: string | null;
  prefix: string;
  objects: ObjectModel[];
  onDeleteBucket?: (bucket: string) => Promise<void>;
  onError?: (message: string) => void;
}

export function useFileBrowserActions({
  accountId,
  currentBucket,
  prefix,
  objects,
  onDeleteBucket,
  onError,
}: UseFileBrowserActionsOptions): FileActionState & FileActionHandlers {
  // Mutations
  const { deleteObject, deleteObjects } = useObjectMutations(accountId, currentBucket || undefined);
  const uploadFiles = useUploadFiles();
  const queryClient = useQueryClient();

  // Dialog states
  const [pendingDeleteBucket, setPendingDeleteBucket] = useState<string | null>(null);
  const [pendingDeleteObject, setPendingDeleteObject] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [previewObject, setPreviewObject] = useState<ObjectModel | null>(null);
  const [localUploading, setLocalUploading] = useState(false);

  // Clipboard
  const [, copyToClipboard] = useCopyToClipboard();

  // Download handler
  const handleDownload = useCallback(
    async (key: string) => {
      if (!accountId || !currentBucket) {
        setErrorMessage("请先选择账户和存储桶");
        onError?.("请先选择账户和存储桶");
        return;
      }

      try {
        const defaultName = key.split("/").pop() || "file";

        const savePath = await saveFileDialog({
          Title: "保存文件",
          DefaultFilename: defaultName,
        });
        if (!savePath) return;

        // Execute download
        const task = await DownloadObject(accountId, currentBucket, key, savePath);
        if (task?.id) {
          queryClient.invalidateQueries({ queryKey: TRANSFERS_KEYS.lists() });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "下载失败";
        logger.error("fileActions.download", "Download failed", {
          accountId,
          bucket: currentBucket,
          key,
          error: message,
          rawError: e,
        });
        setErrorMessage(message);
        onError?.(message);
      }
    },
    [accountId, currentBucket, onError, queryClient],
  );

  // Copy link handler
  const handleCopyLink = useCallback(
    async (key: string) => {
      if (!accountId || !currentBucket) return;
      try {
        const url = await GetPresignedDownloadURL(accountId, currentBucket, key, 60);
        await copyToClipboard(url);
        toast.success("链接已复制", {
          description: "下载链接已复制到剪贴板",
          duration: 2000,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "获取下载链接失败";
        logger.error("fileActions.copyLink", "Copy link failed", {
          accountId,
          bucket: currentBucket,
          key,
          error: message,
          rawError: e,
        });
        setErrorMessage(message);
        onError?.(message);
      }
    },
    [accountId, currentBucket, copyToClipboard, onError],
  );

  // Delete handlers
  const handleDeleteBucket = useCallback(async () => {
    if (!accountId || !pendingDeleteBucket) return;
    try {
      if (onDeleteBucket) {
        await onDeleteBucket(pendingDeleteBucket);
      }
      toast.success("存储桶已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除存储桶失败";
      logger.error("fileActions.deleteBucket", "Delete bucket failed", {
        accountId,
        bucket: pendingDeleteBucket,
        error: message,
        rawError: error,
      });
      toast.error(message);
    } finally {
      setPendingDeleteBucket(null);
    }
  }, [accountId, pendingDeleteBucket, onDeleteBucket]);

  const handleDeleteObject = useCallback(async () => {
    if (!pendingDeleteObject) return;
    try {
      await deleteObject.mutateAsync(pendingDeleteObject);
      toast.success("文件已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除文件失败";
      logger.error("fileActions.deleteObject", "Delete object failed", {
        accountId,
        bucket: currentBucket,
        key: pendingDeleteObject,
        error: message,
        rawError: error,
      });
      toast.error(message);
    } finally {
      setPendingDeleteObject(null);
    }
  }, [pendingDeleteObject, deleteObject]);

  const handleDeleteSelected = useCallback(
    async (keys: string[]) => {
      if (!keys.length) return;
      try {
        await deleteObjects.mutateAsync(keys);
        toast.success(`已删除 ${keys.length} 个文件`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "批量删除失败";
        logger.error("fileActions.deleteSelected", "Batch delete failed", {
          accountId,
          bucket: currentBucket,
          count: keys.length,
          error: message,
          rawError: error,
        });
        toast.error(message);
        throw error;
      }
    },
    [deleteObjects],
  );

  // Preview handler
  // Note: In tree view, files may not be in the global objects array since
  // tree view manages its own node state. We construct a minimal object if needed.
  // Use ref to keep callback stable while accessing latest objects
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  const handlePreview = useCallback((key: string) => {
    // Skip directories
    if (key.endsWith("/")) {
      toast.error("请选择可预览的文件");
      return;
    }

    // Try to find in global objects state first (read from ref for latest value)
    let target = objectsRef.current.find((obj) => obj.key === key && !obj.isDir);

    // If not found, construct a minimal object (for tree view case)
    if (!target) {
      target = {
        key,
        size: 0,
        lastModified: new Date().toISOString() as any,
        etag: "",
        contentType: "",
        storageClass: "",
        versionId: "",
        isDir: false,
        metadata: {},
        isSymlink: false,
        symlinkTarget: "",
      };
    }

    setPreviewObject(target);
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewObject(null);
  }, []);

  // Upload handlers - Desktop only, uses Wails dialogs + backend queue

  // Upload files via Wails file dialog
  const handleUploadClick = useCallback(async () => {
    if (!accountId || !currentBucket) {
      toast.error("请先选择账户和存储桶");
      return;
    }

    try {
      setLocalUploading(true);
      const paths = await OpenMultipleFilesDialog("选择要上传的文件", []);
      if (paths && paths.length > 0) {
        await uploadFiles.mutateAsync({
          filePaths: paths,
          options: {
            accountId,
            bucket: currentBucket,
            prefix,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "选择文件失败";
      logger.error("fileActions.upload", "Upload files failed", {
        accountId,
        bucket: currentBucket,
        prefix,
        error: message,
        rawError: error,
      });
      toast.error(message);
    } finally {
      setLocalUploading(false);
    }
  }, [accountId, currentBucket, prefix, uploadFiles]);

  // Upload folder via Wails directory dialog with file scanning
  const handleUploadFolder = useCallback(async () => {
    if (!accountId || !currentBucket) {
      toast.error("请先选择账户和存储桶");
      return;
    }

    try {
      setLocalUploading(true);
      const result = await OpenDirectoryDialogWithFiles("选择要上传的文件夹");
      if (result && result.files && result.files.length > 0) {
        await uploadFiles.mutateAsync({
          filePaths: result.files,
          options: {
            accountId,
            bucket: currentBucket,
            prefix,
            basePath: result.basePath,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "选择文件夹失败";
      logger.error("fileActions.uploadFolder", "Upload folder failed", {
        accountId,
        bucket: currentBucket,
        prefix,
        error: message,
        rawError: error,
      });
      toast.error(message);
    } finally {
      setLocalUploading(false);
    }
  }, [accountId, currentBucket, prefix, uploadFiles]);

  return {
    // State
    pendingDeleteBucket,
    pendingDeleteObject,
    errorMessage,
    previewObject,
    uploading: localUploading || uploadFiles.isPending, // Combine local + network state

    // Handlers
    handleDownload,
    handleCopyLink,
    handleDeleteBucket,
    handleDeleteObject,
    handleDeleteSelected,
    setPendingDeleteBucket,
    setPendingDeleteObject,
    handlePreview,
    clearPreview,
    handleUploadClick,
    handleUploadFolder,
    reportError: (message: string) => {
      setErrorMessage(message);
      onError?.(message);
    },
  };
}
