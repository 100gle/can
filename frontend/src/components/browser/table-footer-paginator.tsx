/**
 * TableFooterPaginator
 *
 * Pagination controls for the file table footer.
 * Follows shadcn Data Table patterns: selection count on left, navigation on right.
 */

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const DEFAULT_PAGE_SIZES = [30, 50, 100];

export interface TableFooterPaginatorProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Items per page */
  pageSize: number;
  /** Total pages available from loaded data */
  totalPages: number;
  /** Whether there are more items to load from server */
  hasMore: boolean;
  /** Whether currently loading more data */
  loadingMore: boolean;
  /** Number of selected rows */
  selectedCount?: number;
  /** Total number of rows on current page */
  totalRowCount?: number;
  /** Navigate to specific page */
  onPageChange: (page: number) => void;
  /** Load more data from server (when navigating past loaded data) */
  onLoadMore: () => void;
  /** Change page size */
  onPageSizeChange?: (size: number) => void;
  /** Custom page size options */
  pageSizeOptions?: number[];
}

export function TableFooterPaginator({
  currentPage,
  pageSize,
  totalPages,
  hasMore,
  loadingMore,
  selectedCount = 0,
  totalRowCount = 0,
  onPageChange,
  onLoadMore,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
}: TableFooterPaginatorProps) {
  const options = pageSizeOptions.length ? pageSizeOptions : DEFAULT_PAGE_SIZES;
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages || hasMore;

  const handlePrev = () => {
    if (canGoPrev) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      // Navigate within loaded data
      onPageChange(currentPage + 1);
    } else if (hasMore) {
      onPageChange(currentPage + 1);
      // Need to load more data first
      onLoadMore();
    }
  };

  const handlePageSizeChange = (value: string) => {
    const next = Number(value);
    if (!Number.isNaN(next) && next !== pageSize) {
      onPageSizeChange?.(next);
    }
  };

  return (
    <div className="flex items-center justify-between border-t px-4 py-4">
      {/* Left: Selection count (shadcn pattern) */}
      <div className="text-sm text-muted-foreground whitespace-nowrap">
        已选择 {selectedCount} / {totalRowCount} 行
      </div>

      {/* Right: Page size selector + Pagination buttons */}
      <div className="flex items-center gap-4">
        {/* Page size selector */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">每页</span>
            <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Page size" />
              </SelectTrigger>
              <SelectContent align="start">
                {options.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option} 条
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Loading indicator */}
        {loadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        {/* Pagination buttons (shadcn outline style) */}
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!canGoPrev || loadingMore}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!canGoNext || loadingMore}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
