/**
 * FileExplorer
 *
 * Main file browser component for navigating buckets and objects.
 * Refactored to use hooks for state management and actions.
 */

import { DownloadOptionsDialog } from "@/components/objects/download-options-dialog";
import { FilePreviewModal } from "@/components/objects/file-preview-modal";
import { MoveCopyDialog } from "@/components/objects/move-copy-dialog";
import { SearchPanel } from "@/components/search/search-panel";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFileBrowserActions } from "@/hooks/useFileBrowserActions";
import { useFileBrowserController } from "@/hooks/useFileBrowserController";
import { cn } from "@/lib/utils";
import { bucketsStore } from "@/state/buckets";
import { objectsStore, type ObjectModel } from "@/state/objects";
import { searchStore } from "@/state/search";
import { Folder, FolderPlus, Loader2, RefreshCcw, Upload } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BrowserToolbar } from "./browser-toolbar";
import { BucketItem } from "./bucket-item";
import { CreateBucketDialog } from "./create-bucket-dialog";
import { FileItem } from "./file-item";
import { FileTable } from "./file-table";
import { SymlinkDialog } from "./symlink-dialog";
import { TreeView } from "./tree-view";

type FileExplorerProps = {
  accountId?: string;
  onOpenBucketSettings?: (bucket: string) => void;
  className?: string;
};

export function FileExplorer({ accountId, onOpenBucketSettings, className }: FileExplorerProps) {
  const { t } = useTranslation();
  // Use controller hook for state and navigation
  const controller = useFileBrowserController(accountId);

  // Use actions hook for file operations
  const actions = useFileBrowserActions({
    accountId,
    currentBucket: controller.currentBucket,
    prefix: controller.prefix,
    onDeleteBucket: async (bucket) => {
      if (accountId) {
        await bucketsStore.deleteBucket(accountId, bucket);
      }
    },
  });

  // Batch delete confirmation dialog state
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);

  // Render content based on view mode
  const renderContent = () => {
    if (controller.loading && controller.filteredItems.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("loading")}
        </div>
      );
    }

    if (controller.filteredItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Folder className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">
            {controller.hasActiveFilters
              ? t("explorer.empty.noMatch")
              : controller.level === "buckets"
                ? t("explorer.empty.noBuckets")
                : t("explorer.empty.folder")}
          </p>
          {controller.hasActiveFilters && (
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                controller.setSearchTerm("");
                controller.setTypeFilter("all");
              }}
            >
              {t("explorer.action.clearFilter")}
            </Button>
          )}
        </div>
      );
    }

    if (controller.level === "buckets") {
      return (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 120px))" }}
        >
          {controller.filteredItems.map((item) => (
            <BucketItem
              key={(item as any).name}
              bucket={item as any}
              viewMode="grid"
              onEnter={controller.goToBucket}
              onSettings={onOpenBucketSettings}
              onDelete={actions.setPendingDeleteBucket}
            />
          ))}
        </div>
      );
    }

    // Objects view
    if (controller.viewMode === "list") {
      // Filter out directories: check both isDir flag AND if key ends with "/" (S3 convention)
      const listItems = (controller.filteredItems as ObjectModel[]).filter(
        (item) => !item.isDir && !item.key.endsWith("/"),
      );
      return (
        <FileTable
          data={listItems}
          prefix={controller.prefix}
          selectedKeys={controller.selectedKeys}
          lastSelectedKey={controller.lastSelectedKey}
          onToggleSelect={controller.toggleSelect}
          onSelectAll={controller.selectAll}
          onSelectRange={controller.selectRange}
          onSetLastSelectedKey={controller.setLastSelectedKey}
          onClearSelection={controller.clearSelection}
          onEnterFolder={controller.enterFolder}
          onPreview={actions.handlePreview}
          onDownload={actions.handleDownload}
          onCopyLink={actions.handleCopyLink}
          onDelete={actions.setPendingDeleteObject}
          // Pagination
          pageSize={controller.pageSize}
          truncated={controller.truncated}
          loadingMore={controller.loadingMore}
          onLoadMore={() => objectsStore.loadMore()}
          onPageSizeChange={controller.setPageSize}
        />
      );
    }

    if (controller.viewMode === "tree") {
      return (
        <TreeView
          accountId={accountId!}
          bucket={controller.currentBucket!}
          initialPrefix={controller.prefix}
          selectedKeys={controller.selectedKeys}
          selectionVersion={controller.selectedKeysVersion}
          lastSelectedKey={controller.lastSelectedKey}
          onToggleSelect={controller.toggleSelect}
          onSelectAll={controller.selectAll}
          onSelectRange={controller.selectRange}
          onSetLastSelectedKey={controller.setLastSelectedKey}
          onClearSelection={controller.clearSelection}
          onPreview={actions.handlePreview}
          onDownload={actions.handleDownload}
          onCopyLink={actions.handleCopyLink}
          onDelete={actions.setPendingDeleteObject}
          onEnterFolder={controller.enterFolder}
        />
      );
    }

    // Grid view
    return (
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 120px))" }}
      >
        {controller.filteredItems.map((item) => (
          <FileItem
            key={(item as any).key}
            object={item as any}
            prefix={controller.prefix}
            viewMode="grid"
            selected={controller.selectedKeys.has((item as any).key)}
            onToggleSelect={controller.toggleSelect}
            onEnterFolder={controller.enterFolder}
            onPreview={actions.handlePreview}
            onDownload={actions.handleDownload}
            onCopyLink={actions.handleCopyLink}
            onDelete={actions.setPendingDeleteObject}
          />
        ))}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <>
        <Card className={cn("flex h-full flex-col", className)}>
          {/* Unified Toolbar */}
          <BrowserToolbar
            level={controller.level}
            breadcrumbs={controller.breadcrumbs}
            searchTerm={controller.searchTerm}
            onSearchTermChange={controller.setSearchTerm}
            onOpenAdvancedSearch={() => {
              if (accountId) {
                searchStore.setContext(accountId, controller.currentBucket ?? undefined);
              }
              controller.setLevel("search");
              controller.setSearchTerm("");
            }}
            onCloseSearch={controller.goToRoot}
            viewMode={controller.viewMode}
            onViewModeChange={controller.setViewMode}
            isFromCache={controller.isFromCache}
            lastSync={controller.lastSync}
            selectedKeys={controller.selectedKeys}
            canCreateSymlink={controller.canCreateSymlink}
            uploading={actions.uploading}
            onUploadClick={actions.handleUploadClick}
            onCreateBucketClick={() => actions.setCreateBucketOpen(true)}
            onSymlinkClick={() => actions.setSymlinkDialogOpen(true)}
            onDownloadClick={() => actions.setDownloadDialogOpen(true)}
            onMoveCopyClick={() => actions.setMoveCopyDialogOpen(true)}
            onDeleteSelectedClick={() => setDeleteSelectedDialogOpen(true)}
          />

          {controller.level === "search" ? (
            <div className="flex-1 overflow-y-auto p-4">
              <SearchPanel buckets={controller.buckets.map((b) => b.name)} />
            </div>
          ) : (
            <>
              {/* Error */}
              {controller.error && (
                <p className="px-4 pt-2 text-sm text-destructive">{controller.error}</p>
              )}

              {/* Content with context menu */}
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    className={cn(
                      "relative flex-1 min-h-0",
                      controller.viewMode === "list" ? "overflow-hidden" : "overflow-auto",
                    )}
                  >
                    {renderContent()}

                    {/* Show load-more button only for grid/tree modes - list has its own footer */}
                    {controller.level === "objects" &&
                      controller.viewMode === "grid" &&
                      controller.truncated && (
                        <div className="mt-4 text-center">
                          <Button
                            variant="outline"
                            onClick={() => objectsStore.loadMore()}
                            disabled={controller.loadingMore}
                          >
                            {controller.loadingMore && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {t("explorer.action.loadMore")}
                          </Button>
                        </div>
                      )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {controller.level === "buckets" ? (
                    <ContextMenuItem onClick={() => actions.setCreateBucketOpen(true)}>
                      <FolderPlus className="mr-2 h-4 w-4" />
                      {t("contextMenu.newBucket")}
                    </ContextMenuItem>
                  ) : (
                    <>
                      <ContextMenuItem onClick={actions.handleUploadClick}>
                        <Upload className="mr-2 h-4 w-4" />
                        {t("contextMenu.upload")}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={actions.handleUploadFolder}>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        {t("contextMenu.uploadFolder")}
                      </ContextMenuItem>
                    </>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={controller.refresh}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {t("contextMenu.refresh")}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            </>
          )}
        </Card>

        <FilePreviewModal
          open={actions.previewOpen}
          onOpenChange={(openState) => {
            actions.setPreviewOpen(openState);
          }}
          accountId={accountId}
          bucket={controller.currentBucket ?? undefined}
          object={actions.previewObject ?? undefined}
        />

        {/* Create Bucket Dialog */}
        <CreateBucketDialog
          open={actions.createBucketOpen}
          onOpenChange={actions.setCreateBucketOpen}
          accountId={accountId}
          defaultRegion={controller.activeAccount?.region || "us-east-1"}
          isOSSProvider={controller.activeAccount?.provider?.toLowerCase() === "oss"}
          isCOSProvider={controller.activeAccount?.provider?.toLowerCase() === "cos"}
          onError={(_message) => {
            actions.setErrorDialogOpen(true);
          }}
        />

        {/* Delete Bucket Dialog */}
        <AlertDialog
          open={!!actions.pendingDeleteBucket}
          onOpenChange={(o) => !o && actions.setPendingDeleteBucket(null)}
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
              <AlertDialogAction onClick={actions.handleDeleteBucket}>
                {t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Object Dialog */}
        <AlertDialog
          open={!!actions.pendingDeleteObject}
          onOpenChange={(o) => !o && actions.setPendingDeleteObject(null)}
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
              <AlertDialogAction onClick={actions.handleDeleteObject}>
                {t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Symlink Dialog */}
        <SymlinkDialog
          open={actions.symlinkDialogOpen}
          onOpenChange={actions.setSymlinkDialogOpen}
          accountId={accountId}
          bucket={controller.currentBucket ?? undefined}
          prefix={controller.prefix}
          onError={() => {}}
        />

        {/* Download Options Dialog */}
        <DownloadOptionsDialog
          open={actions.downloadDialogOpen}
          onOpenChange={actions.setDownloadDialogOpen}
          objects={controller.objects.filter((o) => controller.selectedKeys.has(o.key))}
          prefix={controller.prefix}
        />

        {/* Move/Copy Dialog */}
        <MoveCopyDialog
          open={actions.moveCopyDialogOpen}
          onOpenChange={actions.setMoveCopyDialogOpen}
          defaultMode="move"
        />

        {/* Error Dialog */}
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

        {/* Batch Delete Confirmation Dialog */}
        <AlertDialog open={deleteSelectedDialogOpen} onOpenChange={setDeleteSelectedDialogOpen}>
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
                    setDeleteSelectedDialogOpen(false);
                  }
                }}
              >
                {t("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}
