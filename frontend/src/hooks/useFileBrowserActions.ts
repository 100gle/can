/**
 * useFileBrowserActions
 *
 * File operation actions for the file browser.
 * Handles downloads, uploads, deletions, previews, and link copying.
 * Desktop-only: all uploads go through backend queue via file paths.
 */

import { isDesktopMode, saveFileDialog } from "@/lib/bridge";
import { objectsStore, useObjectsStore, type ObjectModel } from "@/state/objects";
import { transfersStore } from "@/state/transfers";
import {
  GetPresignedDownloadURL,
  OpenDirectoryDialogWithFiles,
  OpenMultipleFilesDialog,
} from "@wailsjs/go/app/App";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";

export interface FileActionState {
  // Dialog states
  pendingDeleteBucket: string | null;
  pendingDeleteObject: string | null;
  errorDialogOpen: boolean;
  errorMessage: string;
  previewOpen: boolean;
  previewObject: ObjectModel | null;
  downloadDialogOpen: boolean;
  moveCopyDialogOpen: boolean;
  symlinkDialogOpen: boolean;
  createBucketOpen: boolean;

  // Upload states
  uploading: boolean;
}

export interface FileActionHandlers {
  // Download
  handleDownload: (key: string) => Promise<void>;
  handleCopyLink: (key: string) => Promise<void>;

  // Delete
  handleDeleteBucket: () => Promise<void>;
  handleDeleteObject: () => Promise<void>;
  setPendingDeleteBucket: (name: string | null) => void;
  setPendingDeleteObject: (key: string | null) => void;

  // Preview
  handlePreview: (key: string) => void;
  setPreviewOpen: (open: boolean) => void;

  // Upload (Desktop only - uses Wails dialogs + backend queue)
  handleUploadClick: () => Promise<void>;
  handleUploadFolder: () => Promise<void>;

  // Dialogs
  setDownloadDialogOpen: (open: boolean) => void;
  setMoveCopyDialogOpen: (open: boolean) => void;
  setSymlinkDialogOpen: (open: boolean) => void;
  setCreateBucketOpen: (open: boolean) => void;
  setErrorDialogOpen: (open: boolean) => void;
}

interface UseFileBrowserActionsOptions {
  accountId?: string;
  currentBucket: string | null;
  prefix: string;
  onDeleteBucket?: (bucket: string) => Promise<void>;
}

export function useFileBrowserActions({
  accountId,
  currentBucket,
  prefix,
  onDeleteBucket,
}: UseFileBrowserActionsOptions): FileActionState & FileActionHandlers {
  // Object state
  const objects = useObjectsStore((state) => state.objects);
  const uploading = useObjectsStore((state) => state.uploading);

  // Dialog states
  const [pendingDeleteBucket, setPendingDeleteBucket] = useState<string | null>(null);
  const [pendingDeleteObject, setPendingDeleteObject] = useState<string | null>(null);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewObject, setPreviewObject] = useState<ObjectModel | null>(null);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [moveCopyDialogOpen, setMoveCopyDialogOpen] = useState(false);
  const [symlinkDialogOpen, setSymlinkDialogOpen] = useState(false);
  const [createBucketOpen, setCreateBucketOpen] = useState(false);

  // Clipboard
  const [, copyToClipboard] = useCopyToClipboard();

  // Download handler
  const handleDownload = useCallback(
    async (key: string) => {
      if (!accountId || !currentBucket) {
        setErrorMessage("请先选择账户和存储桶");
        setErrorDialogOpen(true);
        return;
      }

      try {
        const defaultName = key.split("/").pop() || "file";

        if (isDesktopMode()) {
          const savePath = await saveFileDialog({
            Title: "保存文件",
            DefaultFilename: defaultName,
          });
          if (!savePath) return;
          await objectsStore.downloadToPath(key, savePath);
        } else {
          const url = await GetPresignedDownloadURL(accountId, currentBucket, key, 300);
          const link = document.createElement("a");
          link.href = url;
          link.download = defaultName;
          link.style.display = "none";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "下载失败";
        setErrorMessage(message);
        setErrorDialogOpen(true);
      }
    },
    [accountId, currentBucket],
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
        setErrorMessage(message);
        setErrorDialogOpen(true);
      }
    },
    [accountId, currentBucket, copyToClipboard],
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
      toast.error(message);
    } finally {
      setPendingDeleteBucket(null);
    }
  }, [accountId, pendingDeleteBucket, onDeleteBucket]);

  const handleDeleteObject = useCallback(async () => {
    if (!pendingDeleteObject) return;
    try {
      await objectsStore.deleteObject(pendingDeleteObject);
      toast.success("文件已删除");
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除文件失败";
      toast.error(message);
    } finally {
      setPendingDeleteObject(null);
    }
  }, [pendingDeleteObject]);

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
    setPreviewOpen(true);
  }, []); // Empty deps - callback is now stable

  // Upload handlers - Desktop only, uses Wails dialogs + backend queue

  // Upload files via Wails file dialog
  const handleUploadClick = useCallback(async () => {
    if (!accountId || !currentBucket) {
      toast.error("请先选择账户和存储桶");
      return;
    }

    if (!isDesktopMode()) {
      toast.error("上传功能仅在桌面模式下可用");
      return;
    }

    try {
      const paths = await OpenMultipleFilesDialog("选择要上传的文件", []);
      if (paths && paths.length > 0) {
        await transfersStore.uploadFilesFromPaths(paths, {
          accountId,
          bucket: currentBucket,
          prefix,
        });
        await transfersStore.syncBackendTasks();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "选择文件失败";
      toast.error(message);
    }
  }, [accountId, currentBucket, prefix]);

  // Upload folder via Wails directory dialog with file scanning
  const handleUploadFolder = useCallback(async () => {
    if (!accountId || !currentBucket) {
      toast.error("请先选择账户和存储桶");
      return;
    }

    if (!isDesktopMode()) {
      toast.error("上传功能仅在桌面模式下可用");
      return;
    }

    try {
      const result = await OpenDirectoryDialogWithFiles("选择要上传的文件夹");
      if (result && result.files && result.files.length > 0) {
        await transfersStore.uploadFilesFromPaths(result.files, {
          accountId,
          bucket: currentBucket,
          prefix,
          basePath: result.basePath, // Preserve directory structure
        });
        await transfersStore.syncBackendTasks();
        toast.success(`已添加 ${result.files.length} 个文件到上传队列`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "选择文件夹失败";
      toast.error(message);
    }
  }, [accountId, currentBucket, prefix]);

  return {
    // State
    pendingDeleteBucket,
    pendingDeleteObject,
    errorDialogOpen,
    errorMessage,
    previewOpen,
    previewObject,
    downloadDialogOpen,
    moveCopyDialogOpen,
    symlinkDialogOpen,
    createBucketOpen,
    uploading,

    // Handlers
    handleDownload,
    handleCopyLink,
    handleDeleteBucket,
    handleDeleteObject,
    setPendingDeleteBucket,
    setPendingDeleteObject,
    handlePreview,
    setPreviewOpen,
    handleUploadClick,
    handleUploadFolder,
    setDownloadDialogOpen,
    setMoveCopyDialogOpen,
    setSymlinkDialogOpen,
    setCreateBucketOpen,
    setErrorDialogOpen,
  };
}
