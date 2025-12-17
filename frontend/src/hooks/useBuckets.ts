import { logger } from "@/lib/logger";
import { queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CreateBucket, DeleteBucket, ListBuckets } from "@wailsjs/go/app/App";
import type { storage as StorageModels } from "@wailsjs/go/models";
import { useEffect, useMemo } from "react";
import { create } from "zustand";

// --- Types ---

export type BucketModel = StorageModels.BucketDescriptor;
export type BucketCreateInput = StorageModels.BucketCreateInput;

const normalizeBucket = (bucket: StorageModels.BucketDescriptor | BucketModel): BucketModel => ({
  ...(bucket as BucketModel),
});

// --- Store ---

type BucketsQueryResult = {
  buckets: BucketModel[];
  selectedBucket?: string;
};

type BucketsUIState = {
  accountId?: string;
  selectedBucket?: string;
  setAccount: (accountId?: string) => void;
  setSelectedBucket: (bucket?: string) => void;
};

const useBucketsUIStore = create<BucketsUIState>((set) => ({
  accountId: undefined,
  selectedBucket: undefined,
  setAccount: (accountId) => set({ accountId, selectedBucket: undefined }),
  setSelectedBucket: (selectedBucket) => set({ selectedBucket }),
}));

// --- Data Fetching ---

const BUCKETS_KEY = (accountId?: string) => ["buckets", accountId];

const fetchBuckets = async (accountId: string): Promise<BucketsQueryResult> => {
  try {
    const payload = await ListBuckets(accountId);
    const buckets = payload.map((bucket) => normalizeBucket(bucket));

    // Auto-select logic
    // We can't easily access "previousSelected" here without passing it in or reading from store,
    // but typically the UI or `useBuckets` hook handles the selection persistance/defaulting.
    // Let's just return the list and let the hook derive selection.

    logger.info("buckets.store.load", "Buckets loaded", {
      accountId,
      count: buckets.length,
    });

    return { buckets };
  } catch (error) {
    logger.error("buckets.store.load", "Failed to load buckets", {
      accountId,
      error,
    });
    throw error;
  }
};

export const useBuckets = (accountId?: string) => {
  const { selectedBucket } = useBucketsUIStore((s) => s);

  const query = useQuery({
    queryKey: BUCKETS_KEY(accountId),
    queryFn: async () => {
      if (!accountId) return { buckets: [] };
      return fetchBuckets(accountId);
    },
    enabled: Boolean(accountId),
    staleTime: 15_000,
    retry: false,
  });

  useEffect(() => {
    if (accountId) {
      useBucketsUIStore.getState().setAccount(accountId);
    }
  }, [accountId]);

  useEffect(() => {
    // If the query returns a selection suggestion (not implemented currently in fetchBuckets)
    // or if we simply need to ensure something is selected when data arrives:
    if ((query.data?.buckets?.length ?? 0) > 0 && !selectedBucket) {
      // Automatically select the first one if nothing is selected
      // However, we should be careful not to override if user explicitly deselected.
      // For now, let's keep the existing behavior: if `query.data.selectedBucket` existed.
      // Since we removed `loadBucketsEffect`'s internal state, we rely on derived state below.
    }
  }, [query.data?.buckets, selectedBucket]);

  const derivedSelected = useMemo(() => {
    if (!query.data?.buckets?.length) return selectedBucket;

    // If current selected is valid, keep it
    if (selectedBucket && query.data.buckets.some((item) => item.name === selectedBucket)) {
      return selectedBucket;
    }

    // Otherwise default to first
    return query.data.buckets[0]?.name;
  }, [query.data?.buckets, selectedBucket]);

  // Sync derived selection back to store if it changed and is not null
  useEffect(() => {
    if (derivedSelected && derivedSelected !== selectedBucket) {
      useBucketsUIStore.getState().setSelectedBucket(derivedSelected);
    }
  }, [derivedSelected, selectedBucket]);

  return {
    buckets: query.data?.buckets ?? [],
    selectedBucket: derivedSelected,
    loading:
      query.isPending ||
      (query.isFetching && (!query.data?.buckets || query.data.buckets.length === 0)),
    error: query.error instanceof Error ? query.error.message : undefined,
    refetch: query.refetch,
  };
};

export const prefetchBuckets = (accountId: string) =>
  queryClient.prefetchQuery({
    queryKey: BUCKETS_KEY(accountId),
    queryFn: () => fetchBuckets(accountId),
  });

export const invalidateBuckets = (accountId?: string) =>
  queryClient.invalidateQueries({ queryKey: BUCKETS_KEY(accountId) });

// --- Mutations ---

export const useCreateBucket = (accountId?: string) => {
  return useMutation({
    mutationFn: async (payload: BucketCreateInput) => {
      const targetAccount = accountId || useBucketsUIStore.getState().accountId;
      if (!targetAccount) {
        throw new Error("必须先选择账户");
      }

      const bucketName = payload.name?.trim() ?? "";
      if (!bucketName) throw new Error("Bucket 名称不能为空");

      const sanitized: BucketCreateInput = {
        name: bucketName,
        region: (payload.region || "").trim(),
        acl: payload.acl?.trim() ?? "",
        storageClass: payload.storageClass?.trim() ?? "",
        cosMultiAz: Boolean(payload.cosMultiAz),
      };
      await CreateBucket(targetAccount, sanitized);

      logger.info("buckets.mutation.create", "Bucket created", {
        accountId: targetAccount,
        bucket: bucketName,
      });
      return targetAccount;
    },
    onSuccess: (targetAccount) => invalidateBuckets(targetAccount),
  });
};

export const useDeleteBucket = (accountId?: string) => {
  return useMutation({
    mutationFn: async (name: string) => {
      const targetAccount = accountId || useBucketsUIStore.getState().accountId;
      if (!targetAccount || !name) return;

      await DeleteBucket(targetAccount, name);

      logger.info("buckets.mutation.delete", "Bucket deleted", {
        accountId: targetAccount,
        bucket: name,
      });

      const selected = useBucketsUIStore.getState().selectedBucket;
      if (selected === name) {
        useBucketsUIStore.getState().setSelectedBucket(undefined);
      }
      return targetAccount;
    },
    onSuccess: (targetAccount) => invalidateBuckets(targetAccount),
  });
};

export const setSelectedBucket = (name?: string) => {
  useBucketsUIStore.getState().setSelectedBucket(name);
};

export const getBucketsSnapshot = (accountId?: string) => {
  const queryData = queryClient.getQueryData<BucketsQueryResult>(BUCKETS_KEY(accountId));
  return {
    buckets: queryData?.buckets ?? [],
    selectedBucket: useBucketsUIStore.getState().selectedBucket,
  };
};
