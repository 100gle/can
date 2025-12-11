import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AccountCard } from "./account-card";
import type { AccountModel } from "@/state/accounts";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => () => undefined,
}));

const buildAccount = (overrides: Partial<AccountModel> = {}): AccountModel => ({
  id: overrides.id ?? "account-1",
  name: overrides.name ?? "测试账户",
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

describe("AccountCard", () => {
  it("shows connection status for healthy probe", () => {
    render(<AccountCard account={buildAccount()} status={{ status: "ok" }} />);
    expect(screen.getByText("连接正常")).toBeTruthy();
  });

  it("shows running label while probe is executing", () => {
    render(<AccountCard account={buildAccount()} status={{ status: "running" }} />);
    expect(screen.getByText("检测中...")).toBeTruthy();
  });
});
