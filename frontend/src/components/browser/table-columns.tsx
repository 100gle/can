import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ObjectModel } from "@/state/objects";
import { ColumnDef } from "@tanstack/react-table";
import { TFunction } from "i18next";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Link2,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { CheckboxCell } from "./checkbox-cell";
import { formatDate, formatSize, getFileIcon } from "./file-utils";

/**
 * Configuration object with getter functions for dynamic state.
 * Using getters allows column definitions to remain stable
 * while the actual state values are fetched at render time.
 */
export interface FileTableColumnConfig {
  getSelectedKeys: () => Set<string>;
  getAllKeys: () => string[];
  getAllSelected: () => boolean;
  getSomeSelected: () => boolean;
  onSelectAll: (keys: string[]) => void;
  onClearSelection: () => void;
  onToggleSelect: (key: string) => void;
  onPreview?: (key: string) => void;
  onDownload?: (key: string) => void;
  onCopyLink?: (key: string) => void;
  onDelete?: (key: string) => void;
  t: TFunction;
}

export function createFileTableColumns(config: FileTableColumnConfig): ColumnDef<ObjectModel>[] {
  const {
    getSelectedKeys,
    getAllKeys,
    getAllSelected,
    getSomeSelected,
    onSelectAll,
    onClearSelection,
    onToggleSelect,
    onPreview,
    onDownload,
    onCopyLink,
    onDelete,
    t,
  } = config;

  return [
    {
      id: "select",
      header: () => {
        const allSelected = getAllSelected();
        const someSelected = getSomeSelected();
        return (
          <CheckboxCell
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={(value: boolean | "indeterminate") => {
              if (value === true || value === "indeterminate") {
                onSelectAll(getAllKeys());
              } else {
                onClearSelection();
              }
            }}
            ariaLabel={t("table.selectAll", "Select all")}
          />
        );
      },
      cell: ({ row }) => {
        const selectedKeys = getSelectedKeys();
        return (
          <CheckboxCell
            checked={selectedKeys.has(row.original.key)}
            onCheckedChange={() => onToggleSelect(row.original.key)}
            ariaLabel={t("table.selectRow", "Select row")}
            onClick={(e) => e.stopPropagation()}
          />
        );
      },
      enableSorting: false,
      enableHiding: false,
      size: 40,
      minSize: 40,
      maxSize: 40,
    },
    {
      accessorKey: "key",
      header: ({ column }) => {
        return (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {t("table.name", "Name")}
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-4 w-4 items-center justify-center shrink-0">
              {getFileIcon(item.key, "h-4 w-4")}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate text-sm text-foreground/90">{item.key}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-[420px] break-all">
                <p className="font-mono text-xs">{item.key}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
      enableResizing: true,
      size: 360,
      minSize: 220,
    },
    {
      accessorKey: "lastModified",
      header: ({ column }) => {
        return (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {t("table.lastModified", "Last Modified")}
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
            )}
          </button>
        );
      },
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {formatDate(row.original.lastModified)}
        </span>
      ),
      enableResizing: true,
      size: 180,
      minSize: 100,
    },
    {
      accessorKey: "isDir",
      header: ({ column }) => {
        return (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {t("table.type", "Type")}
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        if (row.original.isDir)
          return <span className="text-muted-foreground">{t("table.folder", "Folder")}</span>;
        const filename = row.original.key.split("/").pop() || "";
        const parts = filename.split(".");

        if (parts.length > 1) {
          const ext = parts.pop()?.toUpperCase();
          return (
            <span className="text-muted-foreground">
              {t("table.fileType", "{{ext}} File", { ext })}
            </span>
          );
        }
        return <span className="text-muted-foreground">-</span>;
      },
      enableResizing: true,
      size: 120,
      minSize: 80,
    },
    {
      accessorKey: "size",
      header: ({ column }) => {
        return (
          <button
            type="button"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {t("table.size", "Size")}
            {column.getIsSorted() === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === "desc" ? (
              <ArrowDown className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
            )}
          </button>
        );
      },
      cell: ({ row }) => {
        if (row.original.isDir) return <span className="text-muted-foreground">-</span>;
        return (
          <span className="text-muted-foreground font-mono">{formatSize(row.original.size)}</span>
        );
      },
      sortingFn: "basic",
      enableResizing: true,
      size: 120,
      minSize: 80,
    },
    {
      id: "actions",
      header: () => <span className="text-muted-foreground">{t("table.actions", "Actions")}</span>,
      cell: ({ row }) => {
        const item = row.original;
        const isDir = item.isDir;

        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {!isDir && onPreview && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPreview(item.key);
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("actions.preview", "Preview")}</TooltipContent>
              </Tooltip>
            )}
            {!isDir && onDownload && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(item.key);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("common.download", "Download")}</TooltipContent>
              </Tooltip>
            )}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("actions.more", "More Actions")}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end">
                {!isDir && onCopyLink && (
                  <DropdownMenuItem
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      onCopyLink(item.key);
                    }}
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    {t("actions.copyLink", "Copy Link")}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        onDelete(item.key);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("common.delete", "Delete")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
      enableSorting: false,
      size: 120,
      minSize: 120,
      maxSize: 120,
    },
  ];
}
