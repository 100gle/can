import { StoreApi, UseBoundStore } from "zustand";

/**
 * Creates standard bindings for a Zustand store:
 * 1. A typed hook with selector support.
 * 2. An imperative proxy for actions (the "relay" pattern).
 */
export const bindStore = <T extends object>(useStoreBase: UseBoundStore<StoreApi<T>>) => {
  const useStore = <U>(selector: (state: T) => U): U => useStoreBase(selector);
  Object.assign(useStore, useStoreBase);

  const relay = <Args extends unknown[], Return>(
    selector: (store: T) => (...args: Args) => Return,
  ) => {
    return (...args: Args) => selector(useStoreBase.getState())(...args);
  };

  return { useStore: useStore as typeof useStoreBase, relay };
};
