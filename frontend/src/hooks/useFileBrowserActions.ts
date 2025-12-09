/**
 * useFileBrowserActions
 *
 * File operation actions for the file browser.
 * Handles downloads, uploads, deletions, previews, and link copying.
 */

import { isBridgeAvailable, saveFileDialog } from "@/lib/bridge";
import { objectsStore, useObjectsStore, type ObjectModel } from "@/state/objects";
import { transfersStore } from "@/state/transfers";
import { GetPresignedDownloadURL } from "@wailsjs/go/app/App";
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
  dragActive: boolean;

  // Refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
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

  // Upload
  handleFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDrop: (e: React.DragEvent) => void;
  setDragActive: (active: boolean) => void;

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

  // Drag state
  const [dragActive, setDragActive] = useState(false);

  // Upload refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

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

        if (isBridgeAvailable()) {
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
  const handlePreview = useCallback(
    (key: string) => {
      const target = objects.find((obj) => obj.key === key && !obj.isDir);
      if (!target) {
        toast.error("请选择可预览的文件");
        return;
      }
      setPreviewObject(target);
      setPreviewOpen(true);
    },
    [objects],
  );

  // Upload handlers
  const handleFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (!files?.length || !accountId || !currentBucket) return;
      await transfersStore.uploadFiles(Array.from(files), {
        accountId,
        bucket: currentBucket,
        prefix,
      });
      e.target.value = "";
    },
    [accountId, currentBucket, prefix],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (!accountId || !currentBucket) return;
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) {
        void transfersStore.uploadFiles(files, { accountId, bucket: currentBucket, prefix });
      }
    },
    [accountId, currentBucket, prefix],
  );

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
    dragActive,
    fileInputRef,
    folderInputRef,

    // Handlers
    handleDownload,
    handleCopyLink,
    handleDeleteBucket,
    handleDeleteObject,
    setPendingDeleteBucket,
    setPendingDeleteObject,
    handlePreview,
    setPreviewOpen,
    handleFilesSelected,
    handleDrop,
    setDragActive,
    setDownloadDialogOpen,
    setMoveCopyDialogOpen,
    setSymlinkDialogOpen,
    setCreateBucketOpen,
    setErrorDialogOpen,
  };
}
