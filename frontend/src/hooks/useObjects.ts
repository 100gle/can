import { getBucketsSnapshot } from "@/hooks/useBuckets";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BatchDeleteObjects,
  BatchUpdateObjectAttributes,
  CopyObject,
  CreateFolder,
  DeleteObject,
  DownloadBatch,
  ListObjects,
  MoveObjects,
  RenameObject,
  UpdateObjectAttributes,
  UploadObject,
} from "@wailsjs/go/app/App";
import type { objects as ObjectsModels, storage as StorageModels } from "@wailsjs/go/models";

// Types
export type ObjectModel = StorageModels.ObjectDescriptor;

// Constants
export const OBJECTS_QUERY_KEY = "objects";

const normalizeObject = (object: StorageModels.ObjectDescriptor | ObjectModel): ObjectModel => ({
  ...(object as ObjectModel),
});

interface UseObjectsQueryParams {
  accountId?: string;
  bucket?: string;
  prefix: string;
  delimiter?: string;
  pageSize?: number;
}

export const useObjectsQuery = ({
  accountId,
  bucket,
  prefix,
  delimiter = "/",
  pageSize = 50,
}: UseObjectsQueryParams) => {
  return useInfiniteQuery({
    queryKey: [OBJECTS_QUERY_KEY, accountId, bucket, { prefix, delimiter, pageSize }],
    queryFn: async ({ pageParam = "" }) => {
      if (!accountId || !bucket) {
        return { objects: [], nextMarker: "", truncated: false };
      }

      // Find bucket region for optimization
      const currentBucket = getBucketsSnapshot(accountId).buckets.find((b) => b.name === bucket);
      const region = currentBucket?.region || "";

      const payload = await ListObjects(accountId, {
        bucket,
        region,
        prefix,
        delimiter,
        limit: pageSize,
        marker: pageParam,
      });

      return {
        objects: payload.objects.map(normalizeObject),
        nextMarker: payload.nextMarker,
        truncated: payload.truncated,
      };
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => {
      if (!lastPage.truncated) return undefined;
      return lastPage.nextMarker;
    },
    enabled: !!accountId && !!bucket,
    staleTime: 1000 * 30, // 30 seconds
  });
};

export const useObjectMutations = (accountId?: string, bucket?: string) => {
  const queryClient = useQueryClient();
  const invalidateObjects = () => {
    queryClient.invalidateQueries({ queryKey: [OBJECTS_QUERY_KEY] });
  };

  const uploadObject = useMutation({
    mutationFn: async ({ filePath, key }: { filePath: string; key: string }) => {
      if (!accountId || !bucket) throw new Error("No context");
      await UploadObject(accountId, bucket, key, filePath);
      // Polling will pick up new tasks automatically
    },
    onSuccess: invalidateObjects,
  });

  const deleteObject = useMutation({
    mutationFn: async (key: string) => {
      if (!accountId || !bucket) throw new Error("No context");
      await DeleteObject(accountId, bucket, key);
    },
    onSuccess: invalidateObjects,
  });

  const deleteObjects = useMutation({
    mutationFn: async (keys: string[]) => {
      if (!accountId || !bucket) throw new Error("No context");
      await BatchDeleteObjects(accountId, bucket, keys);
    },
    onSuccess: invalidateObjects,
  });

  const createFolder = useMutation({
    mutationFn: async (folderPrefix: string) => {
      if (!accountId || !bucket) throw new Error("No context");
      await CreateFolder(accountId, bucket, folderPrefix);
    },
    onSuccess: invalidateObjects,
  });

  const copyObject = useMutation({
    mutationFn: async ({
      sourceKey,
      targetBucket,
      targetKey,
    }: {
      sourceKey: string;
      targetBucket: string;
      targetKey: string;
    }) => {
      if (!accountId || !bucket) throw new Error("No context");
      await CopyObject(accountId, bucket, sourceKey, targetBucket, targetKey);
    },
    onSuccess: invalidateObjects,
  });

  const renameObject = useMutation({
    mutationFn: async ({ key, newName }: { key: string; newName: string }) => {
      if (!accountId || !bucket) throw new Error("No context");
      // RenameObject(accountId, bucket, oldKey, newKey)
      await RenameObject(accountId, bucket, key, newName);
    },
    onSuccess: invalidateObjects,
  });

  const moveObjects = useMutation({
    mutationFn: async ({
      sourceBucket,
      sourceKeys,
      targetBucket,
      targetPrefix,
    }: {
      sourceBucket: string;
      sourceKeys: string[];
      targetBucket: string;
      targetPrefix: string;
    }) => {
      if (!accountId) throw new Error("No context");

      const requests: ObjectsModels.MoveObjectRequest[] = sourceKeys.map((key) => {
        const fileName = key.split("/").pop() || "";
        return {
          sourceBucket,
          sourceKey: key,
          targetBucket,
          targetKey: targetPrefix ? `${targetPrefix}${fileName}` : fileName,
        } as any; // Cast if constructor check fails or structure slightly mismatch in TS inference
      });

      await MoveObjects(accountId, requests);
    },
    onSuccess: invalidateObjects,
  });

  const moveObjectsBatch = useMutation({
    mutationFn: async (requests: ObjectsModels.MoveObjectRequest[]) => {
      if (!accountId) throw new Error("No context");
      await MoveObjects(accountId, requests);
    },
    onSuccess: invalidateObjects,
  });

  const updateObjectAttributes = useMutation({
    mutationFn: async (patch: ObjectsModels.ObjectAttributesPatch) => {
      if (!accountId) throw new Error("No context");
      await UpdateObjectAttributes(accountId, patch);
    },
    onSuccess: invalidateObjects,
  });

  const batchUpdateObjectAttributes = useMutation({
    mutationFn: async (patches: ObjectsModels.ObjectAttributesPatch[]) => {
      if (!accountId) throw new Error("No context");
      return await BatchUpdateObjectAttributes(accountId, patches);
    },
    onSuccess: invalidateObjects,
  });

  const downloadBatch = useMutation({
    mutationFn: async (payload: ObjectsModels.DownloadBatchInput) => {
      if (!accountId) throw new Error("No context");
      await DownloadBatch(accountId, payload);
    },
    // No invalidation needed for download as it doesn't change server state, usually?
    // But maybe it cleans up something? Assuming no invalidation needed.
  });

  return {
    uploadObject,
    deleteObject,
    deleteObjects,
    createFolder,
    copyObject,
    renameObject,
    moveObjects,
    moveObjectsBatch,
    updateObjectAttributes,
    batchUpdateObjectAttributes,
    downloadBatch,
  };
};
