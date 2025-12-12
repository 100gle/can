/**
 * FileExplorer
 *
 * Main file browser component for navigating buckets and objects.
 * Refactored to use hooks for state management and actions.
 */

import { FileExplorerDialogs } from "@/components/browser/file-explorer-dialogs";
import { SearchPanel } from "@/components/search/search-panel";
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
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { BrowserToolbar } from "./browser-toolbar";
import { BucketItem } from "./bucket-item";
import { FileItem } from "./file-item";
import { FileTable } from "./file-table";
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
  const actions = useFileBrowserActions({
    accountId,
    currentBucket: controller.currentBucket,
    prefix: controller.prefix,
    onDeleteBucket: async (bucket) => {
      if (accountId) {
        await bucketsStore.deleteBucket(accountId, bucket);
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
          onPreview={handlePreview}
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
          onPreview={handlePreview}
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
            onPreview={handlePreview}
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
            onCreateBucketClick={() => setCreateBucketOpen(true)}
            onSymlinkClick={() => setSymlinkDialogOpen(true)}
            onDownloadClick={() => setDownloadDialogOpen(true)}
            onMoveCopyClick={() => setMoveCopyDialogOpen(true)}
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
                    <ContextMenuItem onClick={() => setCreateBucketOpen(true)}>
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
      </>
    </TooltipProvider>
  );
}
