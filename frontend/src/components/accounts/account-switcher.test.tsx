import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { setActiveAccount, useAccounts, useDial, type AccountModel } from "@/hooks/useAccounts";
import { AccountSwitcher } from "./account-switcher";

// Mock the hooks module
vi.mock("@/hooks/useAccounts", () => ({
  useAccounts: vi.fn(),
  useDial: vi.fn(),
  setActiveAccount: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => undefined,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const mockAccount = (overrides: Partial<AccountModel>): AccountModel => ({
  id: overrides.id ?? "account-1",
  name: overrides.name ?? "Mock Account",
  tag: overrides.tag ?? "",
  provider: overrides.provider ?? "aws",
  providerLabel: overrides.providerLabel ?? "AWS",
  endpoint: overrides.endpoint ?? "https://example.com",
  region: overrides.region ?? "cn-hangzhou",
  extra: overrides.extra ?? {},
  useSSL: overrides.useSSL ?? true,
  port: overrides.port ?? 443,
  accessKeyPreview: overrides.accessKeyPreview ?? "TEST***",
  hasSecret: overrides.hasSecret ?? true,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

describe("AccountSwitcher", () => {
  const mockMutateAsync = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllMocks();
    (useDial as unknown as Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
    });
    // Default mock state
    (useAccounts as unknown as Mock).mockReturnValue({
      accounts: [],
      activeAccountId: null,
      dialStatus: {},
      loading: false,
      error: undefined,
    });
  });

  it("displays connection status for the active account", () => {
    (useAccounts as unknown as Mock).mockReturnValue({
      accounts: [mockAccount({ id: "a-1", name: "主账户" })],
      activeAccountId: "a-1",
      dialStatus: {
        "a-1": { status: "ok", message: "All good", checkedAt: new Date().toISOString() },
      },
      loading: false,
    });

    render(<AccountSwitcher />);

    expect(screen.getByText("主账户")).toBeTruthy();
    expect(screen.getByLabelText("account.status.ok")).toBeTruthy();
  });

  it("switches account and triggers connection test asynchronously", async () => {
    const accounts = [
      mockAccount({ id: "a-1", name: "原账户" }),
      mockAccount({ id: "a-2", name: "新账户" }),
    ];

    (useAccounts as unknown as Mock).mockReturnValue({
      accounts,
      activeAccountId: "a-1",
      dialStatus: {
        "a-1": { status: "ok", checkedAt: new Date().toISOString() },
        "a-2": { status: "idle" },
      },
      loading: false,
    });

    render(<AccountSwitcher />);

    const [target] = screen.getAllByText("新账户");
    await act(async () => {
      fireEvent.click(target);
    });

    await waitFor(() => {
      expect(setActiveAccount).toHaveBeenCalledWith("a-2");
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith("a-2");
    });
  });
});
