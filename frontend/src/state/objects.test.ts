import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useObjectsStore } from "./objects";

// Helper to access the store directly
const getStore = () => {
  const { result } = renderHook(() => useObjectsStore((state) => state));
  return result;
};

describe("objectsStore", () => {
  beforeEach(() => {
    const store = getStore();
    act(() => store.current.reset());
  });

  it("sets context and resets selection", () => {
    const store = getStore();

    // Setup initial state
    act(() => {
      store.current.toggleSelect("file1.txt");
    });
    expect(store.current.selectedKeys.has("file1.txt")).toBe(true);

    // Change context
    act(() => {
      store.current.setContext("account-1", "bucket-1");
    });

    expect(store.current.accountId).toBe("account-1");
    expect(store.current.bucket).toBe("bucket-1");
    expect(store.current.selectedKeys.size).toBe(0);
    expect(store.current.prefix).toBe("");
  });

  it("enters prefix and clears selection", () => {
    const store = getStore();

    act(() => {
      store.current.toggleSelect("file1.txt");
      store.current.enterPrefix("folder/");
    });

    expect(store.current.prefix).toBe("folder/");
    expect(store.current.selectedKeys.size).toBe(0);
  });

  it("goes up directory correctly", () => {
    const store = getStore();

    // 1. Root -> No effect
    act(() => store.current.goUp());
    expect(store.current.prefix).toBe("");

    // 2. Folder -> Root
    act(() => store.current.enterPrefix("folder/"));
    expect(store.current.prefix).toBe("folder/");
    act(() => store.current.goUp());
    expect(store.current.prefix).toBe("");

    // 3. Nested -> Parent
    act(() => store.current.enterPrefix("a/b/c/"));
    act(() => store.current.goUp());
    expect(store.current.prefix).toBe("a/b/");
  });

  it("handles selection toggle", () => {
    const store = getStore();

    act(() => store.current.toggleSelect("a"));
    expect(store.current.selectedKeys.has("a")).toBe(true);

    act(() => store.current.toggleSelect("a"));
    expect(store.current.selectedKeys.has("a")).toBe(false);
  });

  it("handles select all", () => {
    const store = getStore();
    const items = ["a", "b", "c"];

    act(() => store.current.selectAll(items));
    expect(store.current.selectedKeys.size).toBe(3);
    items.forEach((k) => expect(store.current.selectedKeys.has(k)).toBe(true));
  });

  it("handles range selection (additive)", () => {
    const store = getStore();

    // Select initial
    act(() => store.current.toggleSelect("a"));

    // Range select merging
    act(() => store.current.selectRange(["b", "c"], { merge: true }));

    expect(store.current.selectedKeys.has("a")).toBe(true);
    expect(store.current.selectedKeys.has("b")).toBe(true);
    expect(store.current.selectedKeys.has("c")).toBe(true);
  });

  it("handles range selection (exclusive)", () => {
    const store = getStore();

    // Select initial
    act(() => store.current.toggleSelect("a"));

    // Range select replace
    act(() => store.current.selectRange(["b", "c"], { merge: false }));

    expect(store.current.selectedKeys.has("a")).toBe(false);
    expect(store.current.selectedKeys.has("b")).toBe(true);
    expect(store.current.selectedKeys.has("c")).toBe(true);
  });
});
