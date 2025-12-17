import { create } from "zustand";
import { bindStore } from "./utils";

interface BucketConfigState {
  accountId: string | null;
  bucket: string | null;

  // Actions
  setContext: (accountId: string, bucket: string) => void;
  reset: () => void;
}

const useBucketConfigStoreBase = create<BucketConfigState>((set) => ({
  accountId: null,
  bucket: null,

  setContext: (accountId, bucket) => set({ accountId, bucket }),
  reset: () =>
    set({
      accountId: null,
      bucket: null,
    }),
}));

const { useStore: useBucketConfigStore, relay } = bindStore(useBucketConfigStoreBase);

export { useBucketConfigStore };

export const bucketConfigStore = {
  setContext: relay((s) => s.setContext),
  reset: relay((s) => s.reset),
  getState: () => useBucketConfigStoreBase.getState(),
};
