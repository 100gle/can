import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const treeMocks = vi.hoisted(() => ({
  listChildrenPaginated: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/state/objects", () => ({
  objectsStore: {
    listChildrenPaginated: treeMocks.listChildrenPaginated,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: treeMocks.toastError,
  },
}));

import { TreeView } from "./tree-view";

beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

const baseProps = {
  accountId: "account-1",
  bucket: "bucket-1",
  initialPrefix: "",
  selectedKeys: new Set<string>(),
  selectionVersion: 0,
  lastSelectedKey: null,
  onToggleSelect: vi.fn(),
  onSelectAll: vi.fn(),
  onSelectRange: vi.fn(),
  onSetLastSelectedKey: vi.fn(),
  onClearSelection: vi.fn(),
  onPreview: vi.fn(),
  onDownload: vi.fn(),
  onCopyLink: vi.fn(),
  onDelete: vi.fn(),
  onEnterFolder: vi.fn(),
};

const { listChildrenPaginated, toastError } = treeMocks;

describe("TreeView error handling", () => {
  beforeEach(() => {
    listChildrenPaginated.mockReset();
    toastError.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an inline error and retry button when root load fails", async () => {
    listChildrenPaginated.mockRejectedValueOnce(new Error("AccessDenied"));

    render(<TreeView {...baseProps} />);

    await waitFor(() => expect(screen.getByText("AccessDenied")).toBeTruthy());
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
    expect(toastError).toHaveBeenCalled();
  });

  it("allows retrying root load after a failure", async () => {
    listChildrenPaginated
      .mockRejectedValueOnce(new Error("临时错误"))
      .mockResolvedValueOnce({ items: [], truncated: false, nextMarker: undefined });

    render(<TreeView {...baseProps} />);

    await waitFor(() => expect(screen.getByText("临时错误")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => expect(listChildrenPaginated).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("文件夹为空")).toBeTruthy());
  });
});
