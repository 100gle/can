import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ObjectModel } from "@/state/objects";
import {
  ColumnResizeMode,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createFileTableColumns } from "./table-columns";
import { TableFooterPaginator } from "./table-footer-paginator";
import { TableRowContextMenu } from "./table-row-context-menu";

interface FileTableProps {
  data: ObjectModel[];
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
  // Pagination props
  pageSize?: number;
  truncated?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onPageSizeChange?: (size: number) => void;
}

const ROW_HEIGHT = 40; // Fixed row height for virtualization
const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [30, 50, 100];

export function FileTable({
  data,
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
  // Pagination
  pageSize = DEFAULT_PAGE_SIZE,
  truncated = false,
  loadingMore = false,
  onLoadMore,
  onPageSizeChange,
}: FileTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");
  const [currentPage, setCurrentPage] = useState(1);
  const parentRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation("common");

  // Reset to page 1 when data changes significantly (e.g., navigation)
  useEffect(() => {
    setCurrentPage(1);
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  }, [prefix]);

  const totalLoaded = data.length;
  const totalPages = Math.max(1, Math.ceil(Math.max(totalLoaded, 1) / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (!truncated && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, truncated]);

  // Calculate paginated data for current page
  const paginatedData = useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, [data, safePage, pageSize]);

  // Use refs to provide stable getter functions for dynamic state
  const paginatedDataRef = useRef(paginatedData);
  paginatedDataRef.current = paginatedData;
  const selectedKeysRef = useRef(selectedKeys);
  selectedKeysRef.current = selectedKeys;

  // Compute selection state (based on current page data)
  const allSelected =
    paginatedData.length > 0 && paginatedData.every((d) => selectedKeys.has(d.key));
  const someSelected = paginatedData.some((d) => selectedKeys.has(d.key)) && !allSelected;

  const allSelectedRef = useRef(allSelected);
  allSelectedRef.current = allSelected;
  const someSelectedRef = useRef(someSelected);
  someSelectedRef.current = someSelected;

  // Handle row click with OS-standard multi-select behavior + Toggle on repeat click
  const handleRowClick = (e: React.MouseEvent, key: string) => {
    if (e.shiftKey && lastSelectedKey) {
      // Shift+Click: Range selection with merge
      const lastIndex = paginatedData.findIndex((item) => item.key === lastSelectedKey);
      const currentIndex = paginatedData.findIndex((item) => item.key === key);

      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const keysToSelect = paginatedData.slice(start, end + 1).map((item) => item.key);
        onSelectRange(keysToSelect, { merge: true });
        onSetLastSelectedKey(key);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: Toggle individual item
      onToggleSelect(key);
      onSetLastSelectedKey(key);
    } else {
      // Plain click
      const isSelected = selectedKeys.has(key);
      const isOnlyOne = selectedKeys.size === 1 && isSelected;

      if (isOnlyOne) {
        // Clicking the only selected item again clears selection
        onClearSelection();
      } else {
        // Select only this item
        onClearSelection();
        onToggleSelect(key);
        onSetLastSelectedKey(key);
      }
    }
  };

  // Create stable column configuration using getter functions
  // This allows columns to remain stable while state changes are fetched at render time
  const columns = useMemo(
    () =>
      createFileTableColumns({
        getSelectedKeys: () => selectedKeysRef.current,
        getAllKeys: () => paginatedDataRef.current.map((d) => d.key),
        getAllSelected: () => allSelectedRef.current,
        getSomeSelected: () => someSelectedRef.current,
        onSelectAll: (keys) => onSelectAll(keys),
        onClearSelection,
        onToggleSelect,
        onPreview,
        onDownload,
        onCopyLink,
        onDelete,
        t,
      }),
    [
      // Only depend on callback functions, not on state values
      onSelectAll,
      onClearSelection,
      onToggleSelect,
      onPreview,
      onDownload,
      onCopyLink,
      onDelete,
      t,
    ],
  );

  const table = useReactTable({
    data: paginatedData,
    columns,
    columnResizeMode,
    enableColumnResizing: true,
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

  // Handle page change with auto-load
  const handlePageChange = (page: number) => {
    const nextPage = Math.max(page, 1);
    setCurrentPage(nextPage);
    // Scroll to top when changing pages
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  };

  const handlePageSizeChange = (size: number) => {
    if (size === pageSize) return;
    onPageSizeChange?.(size);
    setCurrentPage(1);
    if (parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col overflow-hidden rounded-md border bg-card/30">
        {/* Fixed Header */}
        <div className="border-b">
          <div className="flex items-center bg-muted/50">
            {table.getHeaderGroups()[0]?.headers.map((header, index) => {
              const isLastColumn = index === table.getHeaderGroups()[0].headers.length - 1;
              const isNameColumn = header.column.id === "key";
              const flexStyle = isNameColumn ? "1 1 0%" : `0 0 ${header.getSize()}px`;
              return (
                <div
                  key={header.id}
                  className="relative py-2 px-2 text-sm font-medium text-muted-foreground select-none"
                  style={{
                    flex: flexStyle,
                    minWidth: header.column.columnDef.minSize ?? 50,
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                  {/* Resize handle - shown for all resizable columns except last */}
                  {!isLastColumn && header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className={cn(
                        "absolute right-0 top-0 h-full w-2 cursor-col-resize select-none touch-none",
                        "hover:bg-primary/30",
                        header.column.getIsResizing() && "bg-primary/50",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Virtual scrolling container */}
        <div className="flex-1 overflow-hidden min-h-0">
          <div ref={parentRef} className="h-full overflow-auto">
            {rows.length ? (
              <div style={{ height: `${totalSize}px`, position: "relative" }}>
                {virtualRows.map((virtualRow, vIndex) => {
                  const row = rows[virtualRow.index];
                  const isLastVisibleRow = vIndex === virtualRows.length - 1;
                  return (
                    <ContextMenu key={row.id}>
                      <ContextMenuTrigger asChild>
                        <div
                          data-state={selectedKeys.has(row.original.key) && "selected"}
                          className={cn(
                            "flex items-center cursor-pointer hover:bg-muted/50 transition-colors",
                            selectedKeys.has(row.original.key) && "bg-muted",
                            // Only show border if not the last row to avoid scrollbar cutting
                            !isLastVisibleRow && "border-b",
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
                          {row.getVisibleCells().map((cell) => {
                            const isNameColumn = cell.column.id === "key";
                            const flexStyle = isNameColumn
                              ? "1 1 0%"
                              : `0 0 ${cell.column.getSize()}px`;
                            return (
                              <div
                                key={cell.id}
                                className="py-2 px-2 truncate"
                                style={{
                                  flex: flexStyle,
                                  minWidth: cell.column.columnDef.minSize ?? 50,
                                }}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </div>
                            );
                          })}
                        </div>
                      </ContextMenuTrigger>
                      <TableRowContextMenu
                        itemKey={row.original.key}
                        isDir={row.original.isDir}
                        onEnterFolder={onEnterFolder}
                        onPreview={onPreview}
                        onDownload={onDownload}
                        onCopyLink={onCopyLink}
                        onDelete={onDelete}
                      />
                    </ContextMenu>
                  );
                })}
              </div>
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground">
                {t("table.noResults", "No results.")}
              </div>
            )}
          </div>
        </div>

        {/* Footer with Paginator */}
        {onLoadMore && (
          <TableFooterPaginator
            currentPage={currentPage}
            pageSize={pageSize}
            totalPages={totalPages}
            hasMore={truncated}
            loadingMore={loadingMore}
            selectedCount={selectedKeys.size}
            totalRowCount={paginatedData.length}
            onPageChange={handlePageChange}
            onLoadMore={onLoadMore}
            onPageSizeChange={handlePageSizeChange}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
