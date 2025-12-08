import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ObjectModel } from "@/state/objects";
import {
    ColumnDef,
    SortingState,
    flexRender,
    getCoreRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { Download, Eye, Folder, Link2, Share2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react"; // Added useState
import { deriveLabel, formatDate, formatSize, getFileIcon } from "./file-utils";

interface FileTableProps {
  data: ObjectModel[];
  prefix: string;
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  onSelectAll: (keys: string[]) => void;
  onClearSelection: () => void;
  onEnterFolder: (key: string) => void;
  onPreview: (key: string) => void;
  onDownload: (key: string) => void;
  onCopyLink: (key: string) => void;
  onDelete: (key: string) => void;
}

export function FileTable({
  data,
  prefix,
  selectedKeys,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onEnterFolder,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
}: FileTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);

  // Handle shift-select
  const handleRowClick = (e: React.MouseEvent, key: string) => {
    if (e.shiftKey && lastSelectedKey) {
      const lastIndex = data.findIndex((item) => item.key === lastSelectedKey);
      const currentIndex = data.findIndex((item) => item.key === key);
      
      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const keysToSelect = data.slice(start, end + 1).map((item) => item.key);
        // We want to add these to selection, not replace, usually. 
        // But for standard OS behavior, click = select one, shift+click = select range. 
        // Cmd/Ctrl+click is toggle.
        // Since we are clicking the row (not specifically checkbox), let's assume standard behavior:
        // - Click: Select only this (clear others) unless Ctrl/Cmd is held.
        // - Shift+Click: Select range.
        // - Ctrl/Cmd+Click: Toggle.
        
        // However, the props provided are `onToggleSelect`. I might need to implement the logic here 
        // or just use `onSelectAll` for range. 
        // Let's rely on simple toggle for now for the Checkbox column, 
        // and Row click could trigger selection.
      }
    }
    // For now, let's keep row click simple: toggle selection if ctrl/cmd, or select-one if plain click?
    // Current requirement is "Support user multi-select files". 
    // Standard table behavior usually separates "row click" (maybe navigation) from "selection".
    // But in file explorer, row click IS selection.
  };

  const columns = useMemo<ColumnDef<ObjectModel>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) => {
               if (value) {
                 onSelectAll(data.map(d => d.key));
               } else {
                 onClearSelection();
               }
            }}
            aria-label="Select all"
            className="translate-y-[2px]"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedKeys.has(row.original.key)}
            onCheckedChange={() => onToggleSelect(row.original.key)}
            aria-label="Select row"
            className="translate-y-[2px]"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 30, // Fixed width for checkbox
        minSize: 30,
        maxSize: 30,
      },
      {
        accessorKey: "key",
        header: "名称",
        cell: ({ row }) => {
          const item = row.original;
          const label = deriveLabel(item.key, prefix);
          const Icon = item.isDir ? Folder : null;
          
          return (
            <div className="flex items-center gap-2 min-w-[200px]">
              {item.isDir ? (
                 <Folder className="h-4 w-4 text-primary fill-primary/20" />
              ) : (
                 getFileIcon(item.key, "h-4 w-4")
              )}
              <span className="truncate font-medium text-foreground/90">{label}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "lastModified",
        header: "修改日期",
        cell: ({ row }) => <span className="text-muted-foreground whitespace-nowrap">{formatDate(row.original.lastModified)}</span>,
      },
      {
        accessorKey: "isDir", // Helper for sorting by type
        header: "类型",
        cell: ({ row }) => {
             if (row.original.isDir) return <span className="text-muted-foreground">文件夹</span>;
             const ext = row.original.key.split(".").pop()?.toUpperCase() || "FILE";
             return <span className="text-muted-foreground">{ext} 文件</span>;
        },
      },
      {
        accessorKey: "size",
        header: "大小",
        cell: ({ row }) => {
            if (row.original.isDir) return <span className="text-muted-foreground">-</span>;
            return <span className="text-muted-foreground font-mono">{formatSize(row.original.size)}</span>
        },
        sortingFn: "basic",
      },
    ],
    [data, prefix, selectedKeys, onSelectAll, onClearSelection, onToggleSelect]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
    },
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
               <ContextMenu key={row.id}>
                <ContextMenuTrigger asChild>
                  <TableRow
                    data-state={selectedKeys.has(row.original.key) && "selected"}
                    className={cn(
                        "cursor-pointer hover:bg-muted/50 transition-colors", 
                        selectedKeys.has(row.original.key) && "bg-muted"
                    )}
                    onClick={(e) => {
                        // Basic selection logic for row click
                        if (e.ctrlKey || e.metaKey) {
                            onToggleSelect(row.original.key);
                        } else if (e.shiftKey && lastSelectedKey) {
                             // Simple range select logic could go here, 
                             // but for now let's just do single select or toggle
                             // to avoid complex range logic in first iteration.
                             onToggleSelect(row.original.key); 
                        } else {
                             // If clicking valid row without modifiers, clear others and select this
                             onClearSelection();
                             onToggleSelect(row.original.key);
                        }
                        setLastSelectedKey(row.original.key);
                    }}
                    onDoubleClick={() => {
                        if (row.original.isDir) {
                            onEnterFolder(row.original.key);
                        } else {
                            onPreview(row.original.key);
                        }
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent>
                     {row.original.isDir ? (
                       <ContextMenuItem onClick={() => onEnterFolder(row.original.key)}>
                         <Folder className="mr-2 h-4 w-4" />
                         进入
                       </ContextMenuItem>
                     ) : (
                       <>
                         <ContextMenuItem onClick={() => onPreview(row.original.key)}>
                           <Eye className="mr-2 h-4 w-4" />
                           预览
                         </ContextMenuItem>
                         <ContextMenuItem onClick={() => onDownload(row.original.key)}>
                           <Download className="mr-2 h-4 w-4" />
                           下载
                         </ContextMenuItem>
                         <ContextMenuItem onClick={() => onCopyLink(row.original.key)}>
                           <Link2 className="mr-2 h-4 w-4" />
                           复制链接
                         </ContextMenuItem>
                         <ContextMenuItem onClick={() => onCopyLink(row.original.key)}>
                           <Share2 className="mr-2 h-4 w-4" />
                           分享
                         </ContextMenuItem>
                       </>
                     )}
                     <ContextMenuSeparator />
                     <ContextMenuItem
                       onClick={() => onDelete(row.original.key)}
                       className="text-destructive focus:text-destructive"
                     >
                       <Trash2 className="mr-2 h-4 w-4" />
                       删除
                     </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
