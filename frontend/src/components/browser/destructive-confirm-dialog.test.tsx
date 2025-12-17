import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DestructiveConfirmDialog } from "./destructive-confirm-dialog";

// Mock translation
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === "actions.delete.typeToConfirm") return `Type ${options?.text} to confirm`;
      if (key === "actions.delete.placeholder") return `Type ${options?.text}`;
      if (key === "common.cancel") return "Cancel";
      if (key === "common.delete") return "Delete";
      if (key === "common.loading") return "Deleting...";
      return key;
    },
  }),
}));

describe("DestructiveConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Delete Bucket",
    description: "Are you sure?",
    onConfirm: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders correctly", () => {
    render(
      <DestructiveConfirmDialog
        {...defaultProps}
        title="Render Test"
        confirmText="confirm-render"
      />,
    );
    expect(screen.getByText("Render Test")).toBeDefined();
    expect(screen.getByText("Type confirm-render to confirm")).toBeDefined();
    expect(screen.getByPlaceholderText("Type confirm-render")).toBeDefined();
  });

  it("disables delete button initially", () => {
    render(<DestructiveConfirmDialog {...defaultProps} confirmText="confirm-disabled" />);
    const deleteBtn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });

  it("enables delete button when correct text is typed", () => {
    render(<DestructiveConfirmDialog {...defaultProps} confirmText="confirm-enable" />);
    const input = screen.getByPlaceholderText("Type confirm-enable");
    const deleteBtn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "wrong" } });
    expect(deleteBtn.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "confirm-enable" } });
    expect(deleteBtn.disabled).toBe(false);
  });

  it("calls onConfirm when delete button is clicked", async () => {
    render(<DestructiveConfirmDialog {...defaultProps} confirmText="confirm-click" />);
    const input = screen.getByPlaceholderText("Type confirm-click");
    const deleteBtn = screen.getByRole("button", { name: "Delete" });

    fireEvent.change(input, { target: { value: "confirm-click" } });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(defaultProps.onConfirm).toHaveBeenCalled();
    });
  });

  it("clears input when closed", async () => {
    const { rerender } = render(
      <DestructiveConfirmDialog {...defaultProps} confirmText="confirm-clear" />,
    );
    const input = screen.getByPlaceholderText("Type confirm-clear") as HTMLInputElement;

    // Type something
    fireEvent.change(input, { target: { value: "partially typed" } });
    expect(input.value).toBe("partially typed");

    // Close by clicking cancel
    const cancelBtn = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelBtn);

    // Re-open (simulate parent re-opening)
    rerender(
      <DestructiveConfirmDialog {...defaultProps} confirmText="confirm-clear" open={true} />,
    );

    // Check input is empty
    expect(input.value).toBe("");
  });

  it("supports custom confirm text", () => {
    render(<DestructiveConfirmDialog {...defaultProps} confirmText="DELETE" />);
    expect(screen.getByText("Type DELETE to confirm")).toBeDefined();

    const input = screen.getByPlaceholderText("Type DELETE");
    const deleteBtn = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "confirm" } });
    expect(deleteBtn.disabled).toBe(true);

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(deleteBtn.disabled).toBe(false);
  });

  it("shows loading state when isDeleting is true", () => {
    render(<DestructiveConfirmDialog {...defaultProps} isDeleting={true} />);
    expect(screen.getByText("Deleting...")).toBeDefined();
    const btn = screen.getByText("Deleting...") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
