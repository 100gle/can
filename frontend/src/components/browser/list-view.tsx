import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ObjectModel } from "@/state/objects";
import { DatabaseZap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FileTable } from "./file-table";

import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Settings } from "lucide-react";
import { BucketContextMenuItems } from "./file-context-menu";
import { formatDate, formatSize } from "./file-utils";

export type ListViewProps = {
  level: "buckets" | "objects";
  items: Array<any>;
  // Object props
  prefix: string;
  selectedKeys: Set<string>;
  lastSelectedKey: string | null;
  onToggleSelect: (key: string) => void;
  onSelectAll: (keys: string[]) => void;
  onSelectRange: (keys: string[], opts?: { merge?: boolean }) => void;
  onSetLastSelectedKey: (key: string | null) => void;
  onClearSelection: () => void;
  onEnterFolder: (key: string) => void;
  onPreview: (key: string) => void;
  onDownload: (key: string) => void;
  onCopyLink: (key: string) => void;
  onDelete: (key: string) => void;
  // Bucket props
  onEnterBucket?: (name: string) => void;
  onBucketSettings?: (name: string) => void;
  onDeleteBucket?: (name: string) => void;
  // Pagination
  pageSize: number;
  truncated: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onPageSizeChange: (size: number) => void;
};

export function ListView({
  level,
  items,
  // Object props
  prefix,
  selectedKeys,
  lastSelectedKey,
  onToggleSelect,
  onSelectAll,
  onSelectRange,
  onSetLastSelectedKey,
  onClearSelection,
  onEnterFolder,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
  // Bucket props
  onEnterBucket,
  onBucketSettings,
  onDeleteBucket,
  // Pagination
  pageSize,
  truncated,
  loadingMore,
  onLoadMore,
  onPageSizeChange,
}: ListViewProps) {
  const { t } = useTranslation();

  if (level === "buckets") {
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-md border bg-card/30">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="pl-4">{t("table.bucket.name")}</TableHead>
                <TableHead className="w-[180px] text-center">{t("table.bucket.region")}</TableHead>
                <TableHead className="w-[150px] text-center">{t("table.bucket.size")}</TableHead>
                <TableHead className="w-[200px] text-center">
                  {t("table.bucket.creationDate")}
                </TableHead>
                <TableHead className="w-[100px] text-right pr-4">
                  {t("table.bucket.actions")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((bucket) => (
                <BucketTableRow
                  key={bucket.name}
                  bucket={bucket}
                  onEnter={onEnterBucket!}
                  onSettings={onBucketSettings}
                  onDelete={onDeleteBucket!}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // Filter out directories for list view if that's the desired behavior (logic copied from file-explorer.tsx)
  // However, normally FileTable handles what's passed to it.
  // In `file-explorer.tsx` the Logic was:
  // (controller.filteredItems as ObjectModel[]).filter((item) => !item.isDir && !item.key.endsWith("/"));
  // We should preserve this logic if passing to FileTable, OR let FileTable handle it.
  // Since we are moving logic here, let's filter here.
  const objectItems = (items as ObjectModel[]).filter(
    (item) => !item.isDir && !item.key.endsWith("/"),
  );

  return (
    <FileTable
      data={objectItems}
      prefix={prefix}
      selectedKeys={selectedKeys}
      lastSelectedKey={lastSelectedKey}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
      onSelectRange={onSelectRange}
      onSetLastSelectedKey={onSetLastSelectedKey}
      onClearSelection={onClearSelection}
      onEnterFolder={onEnterFolder}
      onPreview={onPreview}
      onDownload={onDownload}
      onCopyLink={onCopyLink}
      onDelete={onDelete}
      // Pagination
      pageSize={pageSize}
      truncated={truncated}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      onPageSizeChange={onPageSizeChange}
    />
  );
}

function BucketTableRow({
  bucket,
  onEnter,
  onSettings,
  onDelete,
}: {
  bucket: any;
  onEnter: (name: string) => void;
  onSettings?: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => onEnter(bucket.name)}
        >
          <TableCell className="pl-4 font-medium">
            <div className="flex items-center gap-2">
              <div className="flex h-4 w-4 items-center justify-center shrink-0 text-primary">
                <DatabaseZap className="h-4 w-4" />
              </div>
              <span className="truncate">{bucket.name}</span>
            </div>
          </TableCell>
          <TableCell className="text-center text-muted-foreground whitespace-nowrap">
            {bucket.region || "-"}
          </TableCell>
          <TableCell className="text-center text-muted-foreground font-mono whitespace-nowrap">
            {formatSize(bucket.size || 0)}
          </TableCell>
          <TableCell className="text-center text-muted-foreground whitespace-nowrap">
            {formatDate(bucket.createdAt)}
          </TableCell>
          <TableCell className="text-right pr-4">
            <div className="flex items-center justify-end gap-1">
              {onSettings && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSettings(bucket.name);
                      }}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.settings")}</TooltipContent>
                </Tooltip>
              )}
            </div>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <BucketContextMenuItems
          bucketName={bucket.name}
          onEnter={onEnter}
          onSettings={onSettings}
          onDelete={onDelete}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
