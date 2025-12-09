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
import { useEffect, useState } from "react";
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

  // Set folder input webkitdirectory
  useEffect(() => {
    if (actions.folderInputRef.current) {
      actions.folderInputRef.current.setAttribute("webkitdirectory", "true");
    }
  }, []);

  // Batch delete confirmation dialog state
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);

  // Render content based on view mode
  const renderContent = () => {
    if (controller.loading && controller.filteredItems.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      );
    }

    if (controller.filteredItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Folder className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-muted-foreground">
            {controller.hasActiveFilters
              ? "没有匹配的项目"
              : controller.level === "buckets"
                ? "暂无存储桶"
                : "文件夹为空"}
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
              清除过滤
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
              onDelete={(name) => actions.setPendingDeleteBucket(name)}
            />
          ))}
        </div>
      );
    }

    // Objects view
    if (controller.viewMode === "list") {
      return (
        <FileTable
          data={controller.filteredItems as ObjectModel[]}
          prefix={controller.prefix}
          selectedKeys={controller.selectedKeys}
          onToggleSelect={controller.toggleSelect}
          onSelectAll={controller.selectAll}
          onClearSelection={controller.clearSelection}
          onEnterFolder={controller.enterFolder}
          onPreview={actions.handlePreview}
          onDownload={actions.handleDownload}
          onCopyLink={actions.handleCopyLink}
          onDelete={(key) => actions.setPendingDeleteObject(key)}
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
          onToggleSelect={controller.toggleSelect}
          onSelectAll={controller.selectAll}
          onClearSelection={controller.clearSelection}
          onPreview={actions.handlePreview}
          onDownload={actions.handleDownload}
          onCopyLink={actions.handleCopyLink}
          onDelete={(key) => actions.setPendingDeleteObject(key)}
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
            onDelete={(key) => actions.setPendingDeleteObject(key)}
          />
        ))}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <>
        <input
          ref={actions.fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={actions.handleFilesSelected}
        />
        <input
          ref={actions.folderInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={actions.handleFilesSelected}
        />

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
            onUploadClick={() => actions.fileInputRef.current?.click()}
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
                    className="relative flex-1 overflow-auto"
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (controller.level === "objects") actions.setDragActive(true);
                    }}
                    onDragLeave={() => actions.setDragActive(false)}
                    onDrop={actions.handleDrop}
                  >
                    {actions.dragActive && (
                      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/90">
                        <div className="text-center">
                          <Upload className="mx-auto h-10 w-10 text-primary" />
                          <p className="mt-2 font-medium">释放以上传</p>
                        </div>
                      </div>
                    )}

                    {renderContent()}

                    {controller.level === "objects" && controller.truncated && (
                      <div className="mt-4 text-center">
                        <Button
                          variant="outline"
                          onClick={() => objectsStore.loadMore()}
                          disabled={controller.loadingMore}
                        >
                          {controller.loadingMore ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          加载更多
                        </Button>
                      </div>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  {controller.level === "buckets" ? (
                    <ContextMenuItem onClick={() => actions.setCreateBucketOpen(true)}>
                      <FolderPlus className="mr-2 h-4 w-4" />
                      新建存储桶
                    </ContextMenuItem>
                  ) : (
                    <>
                      <ContextMenuItem onClick={() => actions.fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" />
                        上传文件
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => actions.folderInputRef.current?.click()}>
                        <FolderPlus className="mr-2 h-4 w-4" />
                        上传文件夹
                      </ContextMenuItem>
                    </>
                  )}
                  <ContextMenuSeparator />
                  <ContextMenuItem onClick={controller.refresh}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    刷新
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
              <AlertDialogTitle>删除存储桶</AlertDialogTitle>
              <AlertDialogDescription>
                确定删除 "{actions.pendingDeleteBucket}"？此操作不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={actions.handleDeleteBucket}>删除</AlertDialogAction>
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
              <AlertDialogTitle>删除文件</AlertDialogTitle>
              <AlertDialogDescription>
                确定删除 "{actions.pendingDeleteObject}"？此操作不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={actions.handleDeleteObject}>删除</AlertDialogAction>
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
              <AlertDialogTitle>操作失败</AlertDialogTitle>
              <AlertDialogDescription>{actions.errorMessage}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => actions.setErrorDialogOpen(false)}>
                确定
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch Delete Confirmation Dialog */}
        <AlertDialog open={deleteSelectedDialogOpen} onOpenChange={setDeleteSelectedDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>批量删除</AlertDialogTitle>
              <AlertDialogDescription>
                确定要删除选中的 {controller.selectedKeys.size} 个项目吗？此操作不可恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  try {
                    await objectsStore.deleteSelected();
                    toast.success(`已删除 ${controller.selectedKeys.size} 个项目`);
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "删除失败";
                    toast.error(message);
                  } finally {
                    setDeleteSelectedDialogOpen(false);
                  }
                }}
              >
                删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </TooltipProvider>
  );
}
