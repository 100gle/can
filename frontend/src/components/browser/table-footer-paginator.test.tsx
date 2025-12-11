import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TableFooterPaginator } from "./table-footer-paginator";

const baseProps = {
  currentPage: 1,
  pageSize: 30,
  totalPages: 2,
  hasMore: false,
  loadingMore: false,
  selectedCount: 0,
  totalRowCount: 30,
  onPageChange: () => {},
  onLoadMore: () => {},
};

describe("TableFooterPaginator", () => {
  afterEach(() => {
    cleanup();
  });

  it("loads more data while advancing the page number", () => {
    const onPageChange = vi.fn();
    const onLoadMore = vi.fn();

    render(
      <TableFooterPaginator
        {...baseProps}
        currentPage={2}
        hasMore
        onPageChange={onPageChange}
        onLoadMore={onLoadMore}
      />,
    );

    const [nextButton] = screen.getAllByText("下一页");
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(3);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("moves within loaded pages without requesting more data", () => {
    const onPageChange = vi.fn();
    const onLoadMore = vi.fn();

    render(
      <TableFooterPaginator
        {...baseProps}
        currentPage={1}
        onPageChange={onPageChange}
        onLoadMore={onLoadMore}
      />,
    );

    const [nextButton] = screen.getAllByText("下一页");
    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(2);
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
