import { DownloadOptionsDialog } from "@/components/objects/download-options-dialog";
import { FilePreviewModal } from "@/components/objects/file-preview-modal";
import { MoveCopyDialog } from "@/components/objects/move-copy-dialog";
import { CreateBucketDialog } from "@/components/browser/create-bucket-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SymlinkDialog } from "./symlink-dialog";
import type { FileActionState, FileActionHandlers } from "@/hooks/useFileBrowserActions";
import type { useFileBrowserController } from "@/hooks/useFileBrowserController";
import { objectsStore } from "@/state/objects";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import type { useFileBrowserController } from "@/hooks/useFileBrowserController";

type FileBrowserController = ReturnType<typeof useFileBrowserController>;

type FileExplorerDialogsProps = {
  accountId?: string;
  controller: FileBrowserController;
  actions: FileActionState & FileActionHandlers;
  deleteSelectedDialogOpen: boolean;
  onDeleteSelectedDialogOpenChange: (open: boolean) => void;
};

export const FileExplorerDialogs: FC<FileExplorerDialogsProps> = ({
  accountId,
  controller,
  actions,
  deleteSelectedDialogOpen,
  onDeleteSelectedDialogOpenChange,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <FilePreviewModal
        open={actions.previewOpen}
        onOpenChange={actions.setPreviewOpen}
        accountId={accountId}
        bucket={controller.currentBucket ?? undefined}
        object={actions.previewObject ?? undefined}
      />

      <CreateBucketDialog
        open={actions.createBucketOpen}
        onOpenChange={actions.setCreateBucketOpen}
        accountId={accountId}
        defaultRegion={controller.activeAccount?.region || "us-east-1"}
        isOSSProvider={controller.activeAccount?.provider?.toLowerCase() === "oss"}
        isCOSProvider={controller.activeAccount?.provider?.toLowerCase() === "cos"}
        onError={() => actions.setErrorDialogOpen(true)}
      />

      <SymlinkDialog
        open={actions.symlinkDialogOpen}
        onOpenChange={actions.setSymlinkDialogOpen}
        accountId={accountId}
        bucket={controller.currentBucket ?? undefined}
        prefix={controller.prefix}
        onError={() => {}}
      />

      <DownloadOptionsDialog
        open={actions.downloadDialogOpen}
        onOpenChange={actions.setDownloadDialogOpen}
        objects={controller.objects.filter((o) => controller.selectedKeys.has(o.key))}
        prefix={controller.prefix}
      />

      <MoveCopyDialog
        open={actions.moveCopyDialogOpen}
        onOpenChange={actions.setMoveCopyDialogOpen}
        defaultMode="move"
      />

      <AlertDialog open={actions.errorDialogOpen} onOpenChange={actions.setErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("error.title")}</AlertDialogTitle>
            <AlertDialogDescription>{actions.errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => actions.setErrorDialogOpen(false)}>
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteSelectedDialogOpen}
        onOpenChange={onDeleteSelectedDialogOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("explorer.dialog.batchDelete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("explorer.dialog.batchDelete.description", {
                count: controller.selectedKeys.size,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try {
                  await objectsStore.deleteSelected();
                  toast.success(
                    t("explorer.message.deleteSuccess", { count: controller.selectedKeys.size }),
                  );
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : t("explorer.message.deleteFailed");
                  toast.error(message);
                } finally {
                  onDeleteSelectedDialogOpenChange(false);
                }
              }}
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!actions.pendingDeleteBucket}
        onOpenChange={(open) => !open && actions.setPendingDeleteBucket(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("explorer.dialog.deleteBucket.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("explorer.dialog.deleteBucket.description", {
                name: actions.pendingDeleteBucket,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={actions.handleDeleteBucket}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!actions.pendingDeleteObject}
        onOpenChange={(open) => !open && actions.setPendingDeleteObject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("explorer.dialog.deleteFile.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("explorer.dialog.deleteFile.description", { name: actions.pendingDeleteObject })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={actions.handleDeleteObject}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
