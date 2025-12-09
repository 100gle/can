/**
 * useFileBrowserController
 *
 * Core state management and navigation logic for the file browser.
 * Extracts the browsing state, breadcrumbs, filtering, and navigation
 * from the monolithic FileExplorer component.
 */

import { useAccountsStore } from "@/state/accounts";
import { bucketsStore, useBucketsStore } from "@/state/buckets";
import { objectsStore, useObjectsStore, type ObjectModel } from "@/state/objects";
import { useEffect, useMemo, useState } from "react";

export type BrowseLevel = "buckets" | "objects" | "search";
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
  truncated: boolean;
  loadingMore: boolean;

  // Cache states
  isFromCache: boolean;
  lastSync: number | undefined;

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
  setLevel: (level: BrowseLevel) => void;

  // Selection
  toggleSelect: typeof objectsStore.toggleSelect;
  selectAll: typeof objectsStore.selectAll;
  clearSelection: typeof objectsStore.clearSelection;

  // Refresh
  refresh: () => void;
}

export function useFileBrowserController(
  accountId?: string,
): FileBrowserState & FileBrowserActions {
  // Bucket state
  const buckets = useBucketsStore((state) => state.buckets);
  const bucketsLoading = useBucketsStore((state) => state.loading);
  const bucketsError = useBucketsStore((state) => state.error);
  const bucketsIsFromCache = useBucketsStore((state) => state.isFromCache);
  const bucketsLastSync = useBucketsStore((state) => state.lastSync);

  // Object state
  const objects = useObjectsStore((state) => state.objects);
  const objectsLoading = useObjectsStore((state) => state.loading);
  const loadingMore = useObjectsStore((state) => state.loadingMore);
  const objectsError = useObjectsStore((state) => state.error);
  const prefix = useObjectsStore((state) => state.prefix);
  const truncated = useObjectsStore((state) => state.truncated);
  const objectsIsFromCache = useObjectsStore((state) => state.isFromCache);
  const objectsLastSync = useObjectsStore((state) => state.lastSync);
  const selectedKeys = useObjectsStore((state) => state.selectedKeys);

  // Account state
  const accounts = useAccountsStore((state) => state.accounts);
  const capabilities = useAccountsStore((state) => state.capabilities);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  );

  const canCreateSymlink = useMemo(() => {
    if (!activeAccount) return false;
    const capability = capabilities.find(
      (cap) => cap.provider === activeAccount.provider && cap.featureId === "object.symlink",
    );
    return Boolean(capability?.supported);
  }, [activeAccount, capabilities]);

  // Browser state
  const [level, setLevel] = useState<BrowseLevel>("buckets");
  const [currentBucket, setCurrentBucket] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Load buckets and reset state when account changes
  useEffect(() => {
    if (accountId) {
      setLevel("buckets");
      setCurrentBucket(null);
      setSearchTerm("");
      setTypeFilter("all");
      objectsStore.reset();
      void bucketsStore.loadBuckets(accountId);
    }
  }, [accountId]);

  // Computed: loading and error
  const loading = level === "buckets" ? bucketsLoading : objectsLoading;
  const error = level === "buckets" ? bucketsError : objectsError;
  const isFromCache = level === "buckets" ? bucketsIsFromCache : objectsIsFromCache;
  const lastSync = level === "buckets" ? bucketsLastSync : objectsLastSync;

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
              void objectsStore.setContext(
                accountId!,
                currentBucket,
                viewMode === "list" ? "" : "/",
              );
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
  }, [level, buckets, objects, searchTerm, typeFilter]);

  const hasActiveFilters = searchTerm !== "" || typeFilter !== "all";

  // Actions
  const goToRoot = () => {
    setLevel("buckets");
    setCurrentBucket(null);
    setSearchTerm("");
    setTypeFilter("all");
  };

  const goToBucket = async (bucketName: string) => {
    if (!accountId) return;
    setCurrentBucket(bucketName);
    setLevel("objects");
    setSearchTerm("");
    setTypeFilter("all");
    const delimiter = viewMode === "list" ? "" : "/";
    await objectsStore.setContext(accountId, bucketName, delimiter);
    objectsStore.clearSelection();
  };

  const enterFolder = (key: string) => {
    void objectsStore.enterPrefix(key.endsWith("/") ? key : `${key}/`);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (level === "objects" && mode !== "tree") {
      const newDelimiter = mode === "list" ? "" : "/";
      void objectsStore.setDelimiter(newDelimiter);
    }
  };

  const refresh = () => {
    if (level === "buckets") {
      void bucketsStore.refresh();
    } else {
      void objectsStore.refresh();
    }
  };

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
    truncated,
    loadingMore,
    isFromCache,
    lastSync,
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
    setLevel,
    toggleSelect: objectsStore.toggleSelect,
    selectAll: objectsStore.selectAll,
    clearSelection: objectsStore.clearSelection,
    refresh,
  };
}
