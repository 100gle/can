import { routeTree } from "@/routeTree.gen";
import { accountsStore } from "@/state/accounts";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Let React know this environment supports `act`
// https://react.dev/reference/react-dom/test-utils/act
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const renderAt = async (path: string) => {
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history });
  const container = document.createElement("div");
  document.body.appendChild(container);

  const root = createRoot(container);
  await act(async () => {
    root.render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>,
    );
    await router.load();
  });

  return { root, container };
};

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.spyOn(accountsStore, "bootstrap").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without entering infinite update loops", async () => {
    const { root, container } = await renderAt("/settings");
    expect(container.textContent).toContain("common.settings");
    await act(async () => {
      root.unmount();
    });
  });
});
