import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ObjectModel } from "@/state/objects";
import {
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import { createFileTableColumns } from "./table-columns";
import { TableRowContextMenu } from "./table-row-context-menu";

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

const ROW_HEIGHT = 40; // Fixed row height for virtualization

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
  const parentRef = useRef<HTMLDivElement>(null);

  // Compute selection state
  const allSelected = data.length > 0 && data.every((d) => selectedKeys.has(d.key));
  const someSelected = data.some((d) => selectedKeys.has(d.key)) && !allSelected;

  // Handle row click with OS-standard multi-select behavior + Toggle on repeat click
  const handleRowClick = (e: React.MouseEvent, key: string) => {
    if (e.shiftKey && lastSelectedKey) {
      // Shift+Click: Range selection
      const lastIndex = data.findIndex((item) => item.key === lastSelectedKey);
      const currentIndex = data.findIndex((item) => item.key === key);

      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const keysToSelect = data.slice(start, end + 1).map((item) => item.key);
        onSelectAll(keysToSelect);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: Toggle individual item
      onToggleSelect(key);
      setLastSelectedKey(key);
    } else {
      // Plain click
      const isSelected = selectedKeys.has(key);
      const isOnlyOne = selectedKeys.size === 1 && isSelected;

      if (isOnlyOne) {
        onClearSelection();
        setLastSelectedKey(null);
      } else {
        onClearSelection();
        onToggleSelect(key);
        setLastSelectedKey(key);
      }
    }
  };

  const columns = useMemo(
    () =>
      createFileTableColumns(
        data,
        prefix,
        selectedKeys,
        allSelected,
        someSelected,
        onSelectAll,
        onClearSelection,
        onToggleSelect,
        onPreview,
        onDownload,
        onCopyLink,
        onDelete,
      ),
    [
      data,
      prefix,
      selectedKeys,
      allSelected,
      someSelected,
      onSelectAll,
      onClearSelection,
      onToggleSelect,
      onPreview,
      onDownload,
      onCopyLink,
      onDelete,
    ],
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

  const { rows } = table.getRowModel();

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Calculate total table width for consistent column alignment
  const tableWidth = table.getAllColumns().reduce((sum, col) => sum + col.getSize(), 0);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="rounded-md border">
        {/* Fixed Header */}
        <div className="overflow-hidden border-b">
          <Table style={{ width: tableWidth, tableLayout: "fixed" }}>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead
                        key={header.id}
                        style={{
                          width: header.getSize(),
                          minWidth: header.getSize(),
                          maxWidth: header.getSize(),
                        }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
          </Table>
        </div>

        {/* Virtual scrolling container */}
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: "calc(100vh - 300px)", minHeight: "300px", maxHeight: "600px" }}
        >
          {rows.length ? (
            <Table style={{ width: tableWidth, tableLayout: "fixed" }}>
              <TableBody style={{ height: `${totalSize}px`, position: "relative" }}>
                {virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <ContextMenu key={row.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow
                          data-state={selectedKeys.has(row.original.key) && "selected"}
                          className={cn(
                            "cursor-pointer hover:bg-muted/50 transition-colors",
                            selectedKeys.has(row.original.key) && "bg-muted",
                          )}
                          style={{
                            height: ROW_HEIGHT,
                            transform: `translateY(${virtualRow.start}px)`,
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                          }}
                          onClick={(e) => handleRowClick(e, row.original.key)}
                          onDoubleClick={() => {
                            if (row.original.isDir) {
                              onEnterFolder(row.original.key);
                            } else {
                              onPreview(row.original.key);
                            }
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell
                              key={cell.id}
                              className="py-2"
                              style={{
                                width: cell.column.getSize(),
                                minWidth: cell.column.getSize(),
                                maxWidth: cell.column.getSize(),
                              }}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </TableCell>
                          ))}
                        </TableRow>
                      </ContextMenuTrigger>
                      <TableRowContextMenu
                        isDir={row.original.isDir}
                        onEnterFolder={() => onEnterFolder(row.original.key)}
                        onPreview={() => onPreview(row.original.key)}
                        onDownload={() => onDownload(row.original.key)}
                        onCopyLink={() => onCopyLink(row.original.key)}
                        onDelete={() => onDelete(row.original.key)}
                      />
                    </ContextMenu>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="h-24 flex items-center justify-center text-muted-foreground">
              No results.
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
