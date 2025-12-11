import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSwitcher } from "./account-switcher";
import { accountsStore, useAccountsStore, type AccountModel } from "@/state/accounts";

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

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockAccount = (overrides: Partial<AccountModel>): AccountModel => ({
  id: overrides.id ?? "account-1",
  name: overrides.name ?? "Mock Account",
  tag: overrides.tag ?? "",
  provider: overrides.provider ?? "aws",
  providerLabel: overrides.providerLabel ?? "AWS",
  endpoint: overrides.endpoint ?? "https://example.com",
  region: overrides.region ?? "cn-hangzhou",
  useSSL: overrides.useSSL ?? true,
  port: overrides.port ?? 443,
  accessKeyPreview: overrides.accessKeyPreview ?? "TEST***",
  hasSecret: overrides.hasSecret ?? true,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

describe("AccountSwitcher", () => {
  beforeEach(() => {
    useAccountsStore.setState((state) => ({
      ...state,
      accounts: [],
      activeAccountId: null,
      connectionTests: {},
      loading: false,
      error: undefined,
    }));
  });

  it("displays connection status for the active account", () => {
    useAccountsStore.setState((state) => ({
      ...state,
      accounts: [mockAccount({ id: "a-1", name: "主账户" })],
      activeAccountId: "a-1",
      connectionTests: {
        "a-1": { status: "ok", message: "All good", checkedAt: new Date().toISOString() },
      },
    }));

    render(<AccountSwitcher />);

    expect(screen.getByText("主账户")).toBeTruthy();
    expect(screen.getByLabelText("连接正常")).toBeTruthy();
  });

  it("switches account and triggers connection test asynchronously", async () => {
    const accounts = [
      mockAccount({ id: "a-1", name: "原账户" }),
      mockAccount({ id: "a-2", name: "新账户" }),
    ];
    const setActiveSpy = vi.spyOn(accountsStore, "setActiveAccount").mockResolvedValue();
    const testConnectionSpy = vi.spyOn(accountsStore, "testConnection").mockResolvedValue();

    useAccountsStore.setState((state) => ({
      ...state,
      accounts,
      activeAccountId: "a-1",
      connectionTests: {
        "a-1": { status: "ok", checkedAt: new Date().toISOString() },
        "a-2": { status: "idle" },
      },
    }));

    render(<AccountSwitcher />);

    const [target] = screen.getAllByText("新账户");
    await act(async () => {
      fireEvent.click(target);
    });

    await act(async () => {
      await waitFor(() => expect(setActiveSpy).toHaveBeenCalledWith("a-2"));
    });
    await act(async () => {
      await waitFor(() => expect(testConnectionSpy).toHaveBeenCalledWith("a-2"));
    });

    setActiveSpy.mockRestore();
    testConnectionSpy.mockRestore();
  });
});
