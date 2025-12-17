/**
 * BrowserToolbar
 *
 * Unified toolbar component for the file browser.
 * Includes breadcrumbs, search, view mode toggle, and action buttons.
 */

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { BrowseLevel, ViewMode } from "@/hooks/useFileBrowserController";
import {
  Download,
  FolderTree,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MoreHorizontal,
  Move,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export interface BrowserToolbarProps {
  // Navigation
  level: BrowseLevel;
  breadcrumbs: Array<{ label: string; onClick?: () => void }>;

  // Search
  searchTerm: string;
  onSearchTermChange: (term: string) => void;

  // View mode
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  // Selection
  selectedKeys: Set<string>;

  // Capabilities
  canCreateSymlink: boolean;
  uploading: boolean;

  // Callbacks
  onUploadClick: () => void;
  onCreateBucketClick: () => void;
  onSymlinkClick: () => void;
  onDownloadClick: () => void;
  onMoveCopyClick: () => void;
  onDeleteSelectedClick: () => void;
  onClearSelection: () => void;
}

// Memoized batch actions menu to prevent toolbar re-renders when selection changes
type BatchActionsMenuProps = {
  selectedCount: number;
  onDownloadClick: () => void;
  onMoveCopyClick: () => void;
  onDeleteSelectedClick: () => void;
  onClearSelection: () => void;
};

const BatchActionsMenu = memo(function BatchActionsMenu({
  selectedCount,
  onDownloadClick,
  onMoveCopyClick,
  onDeleteSelectedClick,
  onClearSelection,
}: BatchActionsMenuProps) {
  const { t } = useTranslation();

  if (selectedCount === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <MoreHorizontal className="h-3.5 w-3.5" />
          <span className="text-sm">{t("toolbar.action.selected", { count: selectedCount })}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-9"
          onClick={() => {
            if (selectedCount === 0) {
              toast.error(t("explorer.message.selectAtLeastOne"));
              return;
            }
            onDownloadClick();
          }}
        >
          <Download className="h-4 w-4" />
          <span>{t("toolbar.action.download")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-9"
          onClick={onMoveCopyClick}
        >
          <Move className="h-4 w-4" />
          <span>{t("toolbar.action.move")}</span>
        </Button>
        <div className="h-px bg-border my-1" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-9"
          onClick={onClearSelection}
        >
          <XCircle className="h-4 w-4" />
          <span>{t("toolbar.action.clearSelection")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 h-9 text-destructive hover:text-destructive"
          onClick={() => {
            if (selectedCount > 0) {
              onDeleteSelectedClick();
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
          <span>{t("toolbar.action.delete")}</span>
        </Button>
      </PopoverContent>
    </Popover>
  );
});

export function BrowserToolbar({
  level,
  breadcrumbs,
  searchTerm,
  onSearchTermChange,
  viewMode,
  onViewModeChange,
  selectedKeys,
  canCreateSymlink,
  uploading,
  onUploadClick,
  onCreateBucketClick,
  onSymlinkClick,
  onDownloadClick,
  onMoveCopyClick,
  onDeleteSelectedClick,
  onClearSelection,
}: BrowserToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex h-14 items-center border-b border-border/40 px-4 gap-4">
      {/* Breadcrumbs - Flexible Width */}
      <div className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap scrollbar-none border-r border-border/10 pr-4">
        <div className="flex items-center text-sm font-medium h-full">
          <Breadcrumb>
            <BreadcrumbList className="flex-nowrap">
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={i}>
                    <BreadcrumbItem className="whitespace-nowrap">
                      {isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button
                            type="button"
                            onClick={crumb.onClick}
                            className="hover:text-foreground transition-colors"
                          >
                            {crumb.label}
                          </button>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Right Actions Area - Auto Width */}
      <div className="shrink-0 flex items-center gap-2">
        {/* Search + View */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                level === "buckets"
                  ? t("toolbar.search.placeholder.buckets")
                  : t("toolbar.search.placeholder.files")
              }
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="h-8 pl-8 pr-8 w-full"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => onSearchTermChange("")}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-md border border-border/40 bg-background shrink-0">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-r-none"
              onClick={() => onViewModeChange("grid")}
              aria-pressed={viewMode === "grid"}
              title={t("toolbar.viewMode.grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-none border-x border-border/20"
              onClick={() => onViewModeChange("list")}
              aria-pressed={viewMode === "list"}
              title={t("toolbar.viewMode.list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "tree" ? "secondary" : "ghost"}
              size="icon"
              className="h-8 w-8 rounded-l-none"
              onClick={() => onViewModeChange("tree")}
              aria-pressed={viewMode === "tree"}
              title={t("toolbar.viewMode.tree")}
            >
              <FolderTree className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 shrink-0">
          {level === "objects" && canCreateSymlink && (
            <Button variant="outline" size="sm" className="h-8 gap-1" onClick={onSymlinkClick}>
              <Link2 className="h-3.5 w-3.5" />
              <span className="hidden lg:inline truncate">{t("toolbar.action.symlink")}</span>
            </Button>
          )}
          {level === "objects" && (
            <Button
              variant="default"
              size="sm"
              className="h-8 gap-1"
              onClick={onUploadClick}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              <span className="hidden lg:inline truncate">{t("toolbar.action.upload")}</span>
            </Button>
          )}
          {level === "objects" && (
            <BatchActionsMenu
              selectedCount={selectedKeys.size}
              onDownloadClick={onDownloadClick}
              onMoveCopyClick={onMoveCopyClick}
              onDeleteSelectedClick={onDeleteSelectedClick}
              onClearSelection={onClearSelection}
            />
          )}
          {level === "buckets" && (
            <Button variant="default" size="sm" className="gap-1 h-8" onClick={onCreateBucketClick}>
              <Plus className="h-3.5 w-3.5" />
              <span className="truncate">{t("toolbar.action.createBucket")}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
