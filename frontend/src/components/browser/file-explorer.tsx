/**
 * FileExplorer
 *
 * Main file browser component for navigating buckets and objects.
 * Refactored to use hooks for state management and actions.
 */

import { FileExplorerDialogs } from "@/components/browser/file-explorer-dialogs";
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
import { useDeleteBucket } from "@/hooks/useBuckets";
import { Folder, FolderPlus, Loader2, RefreshCcw, Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowserToolbar } from "./browser-toolbar";
import { GridView } from "./grid-view";
import { ListView } from "./list-view";
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

  // Dialog states
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [createBucketOpen, setCreateBucketOpen] = useState(false);
  const [symlinkDialogOpen, setSymlinkDialogOpen] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [moveCopyDialogOpen, setMoveCopyDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);

  // Use actions hook for file operations
  const deleteBucketMutation = useDeleteBucket(accountId);
  const actions = useFileBrowserActions({
    accountId,
    currentBucket: controller.currentBucket,
    prefix: controller.prefix,
    objects: controller.objects,
    onDeleteBucket: async (bucket) => {
      if (accountId) {
        await deleteBucketMutation.mutateAsync(bucket);
      }
    },
    onError: () => setErrorDialogOpen(true),
  });

  const previewHandler = actions.handlePreview;
  const handlePreview = useCallback(
    (key: string) => {
      previewHandler(key);
      setPreviewOpen(true);
    },
    [previewHandler],
  );

  // Render content based on view mode
  const renderContent = () => {
    // Show loading only if no items and loading
    if (controller.loading && controller.filteredItems.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("loading")}
        </div>
      );
    }

    // Show empty state
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

    // Tree View (Unified)
    if (controller.viewMode === "tree") {
      return (
        <TreeView
          accountId={accountId!}
          // If level is buckets, bucket is undefined, showing root buckets
          bucket={controller.level === "buckets" ? undefined : controller.currentBucket!}
          initialPrefix={controller.prefix}
          selectedKeys={controller.selectedKeys}
          // selectionVersion removed
          lastSelectedKey={controller.lastSelectedKey}
          onToggleSelect={controller.toggleSelect}
          onSelectAll={controller.selectAll}
          onSelectRange={controller.selectRange}
          onSetLastSelectedKey={controller.setLastSelectedKey}
          onClearSelection={controller.clearSelection}
          onPreview={handlePreview}
          onDownload={actions.handleDownload}
          onCopyLink={actions.handleCopyLink}
          onDelete={actions.setPendingDeleteObject}
          onEnterFolder={controller.enterFolder}
          // Bucket handlers
          onEnterBucket={controller.goToBucket}
          onBucketSettings={onOpenBucketSettings}
          onDeleteBucket={actions.setPendingDeleteBucket}
        />
      );
    }

    // List View (Unified)
    if (controller.viewMode === "list") {
      return (
        <ListView
          level={controller.level}
          items={controller.filteredItems}
          // Object props
          prefix={controller.prefix}
          selectedKeys={controller.selectedKeys}
          lastSelectedKey={controller.lastSelectedKey}
          onToggleSelect={controller.toggleSelect}
          onSelectAll={controller.selectAll}
          onSelectRange={controller.selectRange}
          onSetLastSelectedKey={controller.setLastSelectedKey}
          onClearSelection={controller.clearSelection}
          onEnterFolder={controller.enterFolder}
          onPreview={handlePreview}
          onDownload={actions.handleDownload}
          onCopyLink={actions.handleCopyLink}
          onDelete={actions.setPendingDeleteObject}
          // Bucket props
          onEnterBucket={controller.goToBucket}
          onBucketSettings={onOpenBucketSettings}
          onDeleteBucket={actions.setPendingDeleteBucket}
          // Pagination
          pageSize={controller.pageSize}
          truncated={controller.truncated}
          loadingMore={controller.loadingMore}
          onLoadMore={controller.loadMore}
          onPageSizeChange={controller.setPageSize}
        />
      );
    }

    // Grid View (Unified)
    return (
      <GridView
        level={controller.level}
        items={controller.filteredItems}
        // Object props
        prefix={controller.prefix}
        selectedKeys={controller.selectedKeys}
        onToggleSelect={controller.toggleSelect}
        onEnterFolder={controller.enterFolder}
        onPreview={handlePreview}
        onDownload={actions.handleDownload}
        onCopyLink={actions.handleCopyLink}
        onDelete={actions.setPendingDeleteObject}
        // Bucket props
        onEnterBucket={controller.goToBucket}
        onBucketSettings={onOpenBucketSettings}
        onDeleteBucket={actions.setPendingDeleteBucket}
      />
    );
  };

  return (
    <TooltipProvider>
      <Card className={cn("flex h-full flex-col", className)}>
        {/* Unified Toolbar */}
        <BrowserToolbar
          level={controller.level}
          breadcrumbs={controller.breadcrumbs}
          searchTerm={controller.searchTerm}
          onSearchTermChange={controller.setSearchTerm}
          viewMode={controller.viewMode}
          onViewModeChange={controller.setViewMode}
          selectedKeys={controller.selectedKeys}
          canCreateSymlink={controller.canCreateSymlink}
          uploading={actions.uploading}
          onUploadClick={actions.handleUploadClick}
          onCreateBucketClick={() => setCreateBucketOpen(true)}
          onSymlinkClick={() => setSymlinkDialogOpen(true)}
          onDownloadClick={() => setDownloadDialogOpen(true)}
          onMoveCopyClick={() => setMoveCopyDialogOpen(true)}
          onDeleteSelectedClick={() => setDeleteSelectedDialogOpen(true)}
          onClearSelection={controller.clearSelection}
        />

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
                      onClick={controller.loadMore}
                      disabled={controller.loadingMore}
                    >
                      {controller.loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t("explorer.action.loadMore")}
                    </Button>
                  </div>
                )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {controller.level === "buckets" ? (
              <ContextMenuItem onClick={() => setCreateBucketOpen(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                {t("contextMenu.newBucket")}
              </ContextMenuItem>
            ) : (
              <>
                <ContextMenuItem onClick={actions.handleUploadClick}>
                  <Upload className="mr-2 h-4 w-4" />
                  {t("common.upload")}
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
              {t("common.refresh")}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </Card>

      <FileExplorerDialogs
        accountId={accountId}
        controller={controller}
        actions={actions}
        deleteSelectedDialogOpen={deleteSelectedDialogOpen}
        onDeleteSelectedDialogOpenChange={setDeleteSelectedDialogOpen}
        previewOpen={previewOpen}
        onPreviewOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            actions.clearPreview();
          }
        }}
        createBucketOpen={createBucketOpen}
        onCreateBucketOpenChange={setCreateBucketOpen}
        symlinkDialogOpen={symlinkDialogOpen}
        onSymlinkDialogOpenChange={setSymlinkDialogOpen}
        downloadDialogOpen={downloadDialogOpen}
        onDownloadDialogOpenChange={setDownloadDialogOpen}
        moveCopyDialogOpen={moveCopyDialogOpen}
        onMoveCopyDialogOpenChange={setMoveCopyDialogOpen}
        errorDialogOpen={errorDialogOpen}
        onErrorDialogOpenChange={setErrorDialogOpen}
      />
    </TooltipProvider>
  );
}
