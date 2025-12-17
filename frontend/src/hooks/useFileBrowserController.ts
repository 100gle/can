/**
 * useFileBrowserController
 *
 * Core state management and navigation logic for the file browser.
 * Extracts the browsing state, breadcrumbs, filtering, and navigation
 * from the monolithic FileExplorer component.
 */

import { useAccounts } from "@/hooks/useAccounts";
import { useBuckets } from "@/hooks/useBuckets";
import { useObjectsQuery, type ObjectModel } from "@/hooks/useObjects";
import { objectsStore, useObjectsStore } from "@/state/objects";
import { usePreferencesStore, type ViewMode as PrefsViewMode } from "@/state/preferences";
import { useCallback, useEffect, useMemo, useState } from "react";

export type BrowseLevel = "buckets" | "objects";
export type ViewMode = "list" | "grid" | "tree";

export interface FileBrowserState {
  // Current level
  level: BrowseLevel;
  currentBucket: string | null;
  viewMode: ViewMode;
  searchTerm: string;
  typeFilter: string;

  // Loading states
  loading: boolean;
  error: string | undefined;

  // Data
  buckets: Array<{ name: string; creationDate?: string }>;
  objects: ObjectModel[];
  prefix: string;
  selectedKeys: Set<string>;
  selectedKeysVersion: number;
  lastSelectedKey: string | null;
  truncated: boolean;
  loadingMore: boolean;

  // Pagination
  pageSize: number;
  totalLoaded: number;

  // Computed
  breadcrumbs: Array<{ label: string; onClick?: () => void }>;
  filteredItems: Array<any>;
  hasActiveFilters: boolean;

  // Account info
  activeAccount: { id: string; provider?: string; region?: string } | undefined;
  canCreateSymlink: boolean;
}

export interface FileBrowserActions {
  // Navigation
  goToRoot: () => void;
  goToBucket: (bucketName: string) => Promise<void>;
  enterFolder: (key: string) => void;

  // View controls
  setViewMode: (mode: ViewMode) => void;
  setSearchTerm: (term: string) => void;
  setTypeFilter: (filter: string) => void;

  // Selection
  toggleSelect: typeof objectsStore.toggleSelect;
  selectAll: typeof objectsStore.selectAll;
  selectRange: typeof objectsStore.selectRange;
  setLastSelectedKey: typeof objectsStore.setLastSelectedKey;
  clearSelection: typeof objectsStore.clearSelection;

  // Refresh
  refresh: () => void;
  loadMore: () => void;

  // Pagination
  setPageSize: typeof objectsStore.setPageSize;
}

export function useFileBrowserController(
  accountId?: string,
): FileBrowserState & FileBrowserActions {
  // Bucket state
  const {
    buckets,
    loading: bucketsLoading,
    error: bucketsError,
    refetch: refetchBuckets,
  } = useBuckets(accountId);

  // Store state (UI only)
  const prefix = useObjectsStore((state) => state.prefix);
  const selectedKeys = useObjectsStore((state) => state.selectedKeys);
  const selectedKeysVersion = useObjectsStore((state) => state.selectedKeysVersion);
  const lastSelectedKey = useObjectsStore((state) => state.lastSelectedKey);
  const pageSize = useObjectsStore((state) => state.pageSize);

  // Browser state
  const [level, setLevel] = useState<BrowseLevel>("buckets");
  const [currentBucket, setCurrentBucket] = useState<string | null>(null);
  const prefsViewMode = usePreferencesStore((s) => s.viewMode);
  const setPrefsViewMode = usePreferencesStore((s) => s.setViewMode);
  const [viewMode, setViewMode] = useState<ViewMode>(prefsViewMode);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const delimiter = viewMode === "list" ? "" : "/";

  // Query state
  const {
    data,
    isLoading: isQueryLoading,
    isFetching: isObjectsFetching,
    isFetchingNextPage: loadingMore,
    isError,
    error: queryError,
    fetchNextPage,
    refetch,
    hasNextPage,
  } = useObjectsQuery({
    accountId,
    bucket: currentBucket || undefined,
    prefix,
    delimiter,
    pageSize,
  });

  const objectsLoading =
    isQueryLoading ||
    (isObjectsFetching && !loadingMore && (!data?.pages || data.pages[0]?.objects.length === 0));

  const objectsError = isError
    ? queryError instanceof Error
      ? queryError.message
      : "Failed to load objects"
    : undefined;

  // Flatten pages
  const objects = useMemo(() => {
    if (!data) return [];
    return data.pages.flatMap((page) => page.objects);
  }, [data]);

  const truncated = hasNextPage;

  // Account state
  const { accounts, features } = useAccounts();

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  );

  const canCreateSymlink = useMemo(() => {
    if (!activeAccount) return false;
    const feature = features.find(
      (feat) => feat.provider === activeAccount.provider && feat.featureId === "object.symlink",
    );
    return Boolean(feature?.supported);
  }, [activeAccount, features]);

  // Load buckets and reset state when account changes
  useEffect(() => {
    if (accountId) {
      setLevel("buckets");
      setCurrentBucket(null);
      setSearchTerm("");
      setTypeFilter("all");
      // bucketsStore.loadBuckets is handled by useBucketsStore hook automatically
      // objectsStore.reset(); // This is still valid as it is arguably UI state?
      // Wait, let's keep objectsStore.reset() but remove bucketsStore.loadBuckets
      objectsStore.reset();
    }
  }, [accountId]);

  // Computed: loading and error
  const loading = level === "buckets" ? bucketsLoading : objectsLoading;
  const error = level === "buckets" ? bucketsError : objectsError;

  // Computed: breadcrumbs
  const breadcrumbs = useMemo(() => {
    const goToRoot = () => {
      setLevel("buckets");
      setCurrentBucket(null);
      setSearchTerm("");
      setTypeFilter("all");
    };

    const crumbs: Array<{ label: string; onClick?: () => void }> = [
      { label: "根目录", onClick: goToRoot },
    ];

    if (currentBucket) {
      crumbs.push({
        label: currentBucket,
        onClick: prefix
          ? () => {
              // Just update store execution, query will react
              objectsStore.setContext(accountId!, currentBucket, viewMode === "list" ? "" : "/");
              objectsStore.clearSelection();
            }
          : undefined,
      });
    }

    if (prefix) {
      const segments = prefix.replace(/\/$/, "").split("/").filter(Boolean);
      let cursor = "";
      segments.forEach((seg, i) => {
        cursor += `${seg}/`;
        const isLast = i === segments.length - 1;
        const path = cursor;
        crumbs.push({
          label: seg,
          onClick: isLast ? undefined : () => objectsStore.enterPrefix(path),
        });
      });
    }

    return crumbs;
  }, [currentBucket, prefix, accountId, viewMode]);

  // Computed: filtered items
  const filteredItems = useMemo(() => {
    if (level === "buckets") {
      return buckets.filter((b) => {
        if (searchTerm && !b.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        return true;
      });
    } else {
      return objects.filter((obj) => {
        // Skip current prefix itself (the directory we're in)
        if (obj.key === prefix) return false;
        if (searchTerm && !obj.key.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        if (typeFilter !== "all") {
          const ext = obj.key.split(".").pop()?.toLowerCase() || "";
          if (typeFilter === "folder" && !obj.isDir) return false;
          if (typeFilter === "image" && !["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
            return false;
          if (typeFilter === "document" && !["pdf", "doc", "docx", "txt", "md"].includes(ext))
            return false;
        }
        return true;
      });
    }
  }, [level, buckets, objects, searchTerm, typeFilter, prefix]);

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "all";

  // Actions - memoized to prevent child re-renders
  const goToRoot = useCallback(() => {
    setLevel("buckets");
    setCurrentBucket(null);
    setSearchTerm("");
    setTypeFilter("all");
  }, []);

  const goToBucket = useCallback(
    async (bucketName: string) => {
      if (!accountId) return;
      setCurrentBucket(bucketName);
      setLevel("objects");
      setSearchTerm("");
      setTypeFilter("all");
      const delimiter = viewMode === "list" ? "" : "/";

      // Update store context, query reacts automatically
      objectsStore.setContext(accountId, bucketName, delimiter);
      objectsStore.clearSelection();
    },
    [accountId, viewMode],
  );

  const enterFolder = useCallback((key: string) => {
    objectsStore.enterPrefix(key.endsWith("/") ? key : `${key}/`);
  }, []);

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      setPrefsViewMode(mode as PrefsViewMode);
      if (level === "objects" && mode !== "tree") {
        const newDelimiter = mode === "list" ? "" : "/";
        objectsStore.setDelimiter(newDelimiter);
      }
    },
    [level, setPrefsViewMode],
  );

  const refresh = useCallback(() => {
    if (level === "buckets") {
      void refetchBuckets();
    } else {
      void refetch();
    }
  }, [level, refetch]);

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);

  return {
    // State
    level,
    currentBucket,
    viewMode,
    searchTerm,
    typeFilter,
    loading,
    error,
    buckets,
    objects,
    prefix,
    selectedKeys,
    selectedKeysVersion,
    lastSelectedKey,
    truncated: !!truncated,
    loadingMore,
    pageSize,
    totalLoaded: objects.length,
    breadcrumbs,
    filteredItems,
    hasActiveFilters,
    activeAccount,
    canCreateSymlink,

    // Actions
    goToRoot,
    goToBucket,
    enterFolder,
    setViewMode: handleViewModeChange,
    setSearchTerm,
    setTypeFilter,
    toggleSelect: objectsStore.toggleSelect,
    selectAll: objectsStore.selectAll,
    selectRange: objectsStore.selectRange,
    setLastSelectedKey: objectsStore.setLastSelectedKey,
    clearSelection: objectsStore.clearSelection,
    refresh,
    loadMore,
    setPageSize: objectsStore.setPageSize,
  };
}
