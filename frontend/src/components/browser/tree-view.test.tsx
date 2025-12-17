import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ListObjects } from "@wailsjs/go/app/App";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { TreeView } from "./tree-view";

const treeMocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

const { toastError } = treeMocks;

vi.mock("@/hooks/useBuckets", () => ({
  getBucketsSnapshot: () => ({
    buckets: [{ name: "bucket-1", region: "region-1" }],
  }),
  prefetchBuckets: vi.fn(),
  useBuckets: () => ({
    buckets: [{ name: "bucket-1", region: "region-1" }],
    loading: false,
    error: null,
  }),
}));

vi.mock("@/state/accounts", () => ({
  accountsStore: {
    getState: () => ({
      activeAccountId: "account-1",
    }),
  },
}));

vi.mock("@wailsjs/go/app/App", () => ({
  ListObjects: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: treeMocks.toastError,
  },
}));

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

describe("TreeView error handling", () => {
  beforeEach(() => {
    (ListObjects as Mock).mockReset();
    toastError.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows an inline error and retry button when root load fails", async () => {
    (ListObjects as Mock).mockRejectedValueOnce(new Error("AccessDenied"));

    render(<TreeView {...baseProps} />);

    await waitFor(() => expect(screen.getByText("AccessDenied")).toBeTruthy());
    expect(screen.getByRole("button", { name: "common.retry" })).toBeTruthy();
    expect(toastError).toHaveBeenCalled();
  });

  it("allows retrying root load after a failure", async () => {
    (ListObjects as Mock)
      .mockRejectedValueOnce(new Error("临时错误"))
      .mockResolvedValueOnce({ objects: [], truncated: false, nextMarker: "" });

    render(<TreeView {...baseProps} />);

    await waitFor(() => expect(screen.getByText("临时错误")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "common.retry" }));

    await waitFor(() => expect(ListObjects).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText("treeView.folderEmpty")).toBeTruthy());
  });
});
