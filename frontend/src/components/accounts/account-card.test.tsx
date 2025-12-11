import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AccountModel } from "@/state/accounts";
import { AccountCard } from "./account-card";

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
  it("renders account name and provider", () => {
    render(<AccountCard account={buildAccount()} />);
    expect(screen.getByText("测试账户")).toBeTruthy();
    expect(screen.getByText("AWS")).toBeTruthy();
  });

  it("renders account tag when present", () => {
    render(<AccountCard account={buildAccount({ tag: "production" })} />);
    expect(screen.getByText("production")).toBeTruthy();
  });
});
