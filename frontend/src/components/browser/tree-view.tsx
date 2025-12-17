import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { getBucketsSnapshot, prefetchBuckets } from "@/hooks/useBuckets";
import { OBJECTS_QUERY_KEY } from "@/hooks/useObjects";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { ListObjects } from "@wailsjs/go/app/App";
import type { storage as StorageModels } from "@wailsjs/go/models";
import { ChevronDown, ChevronRight, DatabaseZap, Folder, Link2, Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BucketContextMenuItems, FileContextMenuItems } from "./file-context-menu";
import { deriveLabel, getFileIcon } from "./file-utils";

/** Max items to load per folder expansion to prevent OOM with large folders */
const TREE_PAGE_SIZE = 100;
export type TreeObject = StorageModels.ObjectDescriptor;

// Helper to list children for tree view (replaces objectsStore.listChildrenPaginated)
interface ListChildrenOptions {
  accountId: string;
  bucket: string;
  prefix: string;
  limit: number;
  marker?: string;
}

interface ListObjectsResult {
  objects: StorageModels.ObjectDescriptor[];
  nextMarker: string;
  truncated: boolean;
}

async function listChildrenPaginated({
  accountId,
  bucket,
  prefix,
  limit,
  marker,
}: ListChildrenOptions): Promise<ListObjectsResult> {
  const region = getBucketsSnapshot(accountId).buckets.find((b) => b.name === bucket)?.region ?? "";
  return queryClient.fetchQuery({
    queryKey: [
      OBJECTS_QUERY_KEY,
      accountId,
      bucket,
      { prefix, delimiter: "/", limit, marker: marker ?? "" },
    ],
    queryFn: async () =>
      (await ListObjects(accountId, {
        bucket,
        region,
        prefix,
        delimiter: "/",
        limit,
        marker: marker ?? "",
      })) as unknown as ListObjectsResult,
    staleTime: 30_000,
  });
}

export type TreeViewProps = {
  accountId: string;
  // If bucket is provided, only show objects in that bucket (old behavior)
  // If bucket is NOT provided, show list of buckets as roots
  bucket?: string;
  initialPrefix?: string;
  selectedKeys?: Set<string>;
  lastSelectedKey?: string | null;
  onToggleSelect?: (key: string) => void;
  onSelectAll?: (keys: string[]) => void;
  onSelectRange?: (keys: string[], opts?: { merge?: boolean }) => void;
  onSetLastSelectedKey?: (key: string | null) => void;
  onClearSelection?: () => void;
  onPreview?: (key: string) => void;
  onDownload?: (key: string) => void;
  onCopyLink?: (key: string) => void;
  onDelete?: (key: string) => void;
  // Bucket handlers
  onEnterBucket?: (name: string) => void;
  onBucketSettings?: (name: string) => void;
  onDeleteBucket?: (name: string) => void;
  // Folder handler
  onEnterFolder: (key: string) => void;
};

type NodeState = "collapsed" | "loading" | "expanded";

type TreeNodeData = {
  object: TreeObject;
  children: TreeNodeData[];
  state: NodeState;
  parentPrefix: string;
  // If this node represents a bucket (at root level)
  isBucketRoot?: boolean;
  // The bucket this node belongs to (required for children of bucket nodes)
  bucketName?: string;

  // Pagination for lazy loading
  truncated?: boolean;
  nextMarker?: string;
  loadingMore?: boolean;
};

export function TreeView({
  accountId,
  bucket,
  initialPrefix = "",
  selectedKeys,
  // selectionVersion removed
  lastSelectedKey,
  onToggleSelect,
  onSelectAll: _onSelectAll,
  onSelectRange,
  onSetLastSelectedKey,
  onSetLastSelectedKey: _onSetLastSelectedKey, // duplicate in props but safe to ignore
  onClearSelection: _onClearSelection,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
  onEnterBucket,
  onBucketSettings,
  onDeleteBucket,
  onEnterFolder,
}: TreeViewProps) {
  const { t } = useTranslation();
  const [nodes, setNodes] = useState<TreeNodeData[]>([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootLoaded, setRootLoaded] = useState(false);
  const [rootTruncated, setRootTruncated] = useState(false);
  const [rootNextMarker, setRootNextMarker] = useState<string | undefined>(undefined);
  const [rootLoadingMore, setRootLoadingMore] = useState(false);
  const [rootError, setRootError] = useState<string | null>(null);

  // Ref for intersection observer (root level lazy loading)
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodes([]);
    setRootLoaded(false);
    setRootTruncated(false);
    setRootNextMarker(undefined);
    setRootLoadingMore(false);
    setRootError(null);
  }, [accountId, bucket, initialPrefix]);
  const loadRoot = useCallback(async () => {
    if (rootLoaded || rootLoading) return;
    setRootLoading(true);
    setRootError(null);
    try {
      if (!bucket) {
        // Load Buckets
        await prefetchBuckets(accountId);
        const { buckets } = getBucketsSnapshot(accountId);

        // Note: listBuckets returns simple objects, we need to adapt to TreeNodeData
        setNodes(
          buckets.map((b: any) => ({
            object: {
              key: b.name,
              isDir: true,
              size: 0,
              lastModified: b.creationDate,
              etag: "",
              isSymlink: false,
              symlinkTarget: "",
              storageClass: "",
              contentType: "", // Directory-like
              metadata: {},
              versionId: "",
            },
            children: [],
            state: "collapsed" as NodeState,
            parentPrefix: "",
            isBucketRoot: true,
            bucketName: b.name,
          })),
        );
        // Buckets list is not paginated in current store API
        setRootTruncated(false);
        setRootNextMarker(undefined);
      } else {
        // Load Objects
        const result = await listChildrenPaginated({
          accountId,
          bucket,
          prefix: initialPrefix,
          limit: TREE_PAGE_SIZE,
        });
        setNodes(
          (result.objects || []).map((obj) => ({
            object: obj,
            children: [],
            state: "collapsed" as NodeState,
            parentPrefix: initialPrefix,
            bucketName: bucket,
          })),
        );
        setRootTruncated(Boolean(result.truncated));
        setRootNextMarker(result.nextMarker);
      }
      setRootLoaded(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("treeView.loadRootFailed");
      setRootError(message);
      setRootLoaded(true);
      toast.error(t("treeView.cannotLoadRoot"), { description: message });
    } finally {
      setRootLoading(false);
    }
  }, [accountId, bucket, initialPrefix, rootLoaded, rootLoading, t]);

  // Auto-load root
  useEffect(() => {
    if (!rootLoaded && !rootLoading) {
      void loadRoot();
    }
  }, [rootLoaded, rootLoading, loadRoot]);

  // Load more root items (lazy loading via IntersectionObserver)
  const loadMoreRoot = useCallback(async () => {
    if (!rootTruncated || !rootNextMarker || rootLoadingMore || !bucket) return;
    setRootLoadingMore(true);
    try {
      // Only for objects view
      const result = await listChildrenPaginated({
        accountId,
        bucket,
        prefix: initialPrefix,
        limit: TREE_PAGE_SIZE,
        marker: rootNextMarker,
      });
      setNodes((prev) => [
        ...prev,
        ...(result.objects || []).map((obj) => ({
          object: obj,
          children: [],
          state: "collapsed" as NodeState,
          parentPrefix: initialPrefix,
          bucketName: bucket,
        })),
      ]);
      setRootTruncated(Boolean(result.truncated));
      setRootNextMarker(result.nextMarker);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("treeView.loadMoreFailed");
      toast.error(message);
    } finally {
      setRootLoadingMore(false);
    }
  }, [accountId, bucket, initialPrefix, rootTruncated, rootNextMarker, rootLoadingMore, t]);

  // Intersection observer for lazy loading at root level
  useEffect(() => {
    if (!rootTruncated || !loadMoreSentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !rootLoadingMore) {
          void loadMoreRoot();
        }
      },
      { threshold: 0.1, rootMargin: "100px" },
    );

    observer.observe(loadMoreSentinelRef.current);
    return () => observer.disconnect();
  }, [rootTruncated, rootLoadingMore, loadMoreRoot]);

  const handleRootRetry = () => {
    setNodes([]);
    setRootError(null);
    setRootLoaded(false);
    setRootTruncated(false);
    setRootNextMarker(undefined);
    setRootLoadingMore(false);
  };

  // Flatten all visible nodes for range selection
  const getAllVisibleKeys = (): string[] => {
    const keys: string[] = [];
    const traverse = (nodeList: TreeNodeData[]) => {
      for (const node of nodeList) {
        keys.push(node.object.key);
        if (node.state === "expanded" && node.children.length > 0) {
          traverse(node.children);
        }
      }
    };
    traverse(nodes);
    return keys;
  };

  // Handle node selection with OS-standard multi-select behavior
  const handleNodeClick = (e: React.MouseEvent, key: string, isBucket?: boolean) => {
    if (isBucket) return; // Don't select buckets in tree view (for now, or maybe we want to?)
    if (!onToggleSelect) return;

    if (e.shiftKey && lastSelectedKey && onSelectRange && onSetLastSelectedKey) {
      // Shift+Click: Range selection with merge
      const allKeys = getAllVisibleKeys();
      const lastIndex = allKeys.indexOf(lastSelectedKey);
      const currentIndex = allKeys.indexOf(key);

      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const keysToSelect = allKeys.slice(start, end + 1);
        onSelectRange(keysToSelect, { merge: true });
        onSetLastSelectedKey(key);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: Toggle individual item
      onToggleSelect(key);
      onSetLastSelectedKey?.(key);
    } else {
      // Plain click: Toggle selection (same as checkbox behavior)
      onToggleSelect(key);
      onSetLastSelectedKey?.(key);
    }
  };

  const toggleNode = async (path: number[]) => {
    const node = getNodeByPath(nodes, path);
    if (!node || !node.object.isDir) return;

    if (node.state === "expanded") {
      // Collapse
      setNodes((prev) => updateNodeByPath(prev, path, { state: "collapsed" }));
    } else if (node.state === "collapsed") {
      // Expand - load children with pagination
      setNodes((prev) => updateNodeByPath(prev, path, { state: "loading" }));
      try {
        const targetBucket = node.bucketName || bucket!;
        const targetPrefix = node.isBucketRoot ? "" : node.object.key;

        const result = await listChildrenPaginated({
          accountId,
          bucket: targetBucket,
          prefix: targetPrefix,
          limit: TREE_PAGE_SIZE,
        });
        setNodes((prev) =>
          updateNodeByPath(prev, path, {
            state: "expanded",
            truncated: result.truncated,
            nextMarker: result.nextMarker,
            children: (result.objects || []).map((obj) => ({
              object: obj,
              children: [],
              state: "collapsed" as NodeState,
              parentPrefix: targetPrefix,
              bucketName: targetBucket,
            })),
          }),
        );
      } catch (error) {
        setNodes((prev) => updateNodeByPath(prev, path, { state: "collapsed" }));
        const message = error instanceof Error ? error.message : t("treeView.loadChildrenFailed");
        toast.error(message);
      }
    }
  };

  // Load more children for a node (triggered by intersection observer in TreeNode)
  const loadMoreChildren = async (path: number[]) => {
    const node = getNodeByPath(nodes, path);
    if (!node || !node.truncated || !node.nextMarker || node.loadingMore) return;

    setNodes((prev) => updateNodeByPath(prev, path, { loadingMore: true }));
    try {
      const targetBucket = node.bucketName || bucket!;
      const targetPrefix = node.isBucketRoot ? "" : node.object.key;

      const result = await listChildrenPaginated({
        accountId,
        bucket: targetBucket,
        prefix: targetPrefix,
        limit: TREE_PAGE_SIZE,
        marker: node.nextMarker,
      });
      setNodes((prev) => {
        const current = getNodeByPath(prev, path);
        if (!current) return prev;
        return updateNodeByPath(prev, path, {
          loadingMore: false,
          truncated: result.truncated,
          nextMarker: result.nextMarker,
          children: [
            ...current.children,
            ...(result.objects || []).map((obj) => ({
              object: obj,
              children: [],
              state: "collapsed" as NodeState,
              parentPrefix: targetPrefix,
              bucketName: targetBucket,
            })),
          ],
        });
      });
    } catch (error) {
      setNodes((prev) => updateNodeByPath(prev, path, { loadingMore: false }));
      const message = error instanceof Error ? error.message : t("treeView.loadMoreFailed");
      toast.error(message);
    }
  };

  if (rootError) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p>{rootError}</p>
        <div>
          <Button variant="destructive" size="sm" onClick={handleRootRetry}>
            {t("common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (rootLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Folder className="h-12 w-12 text-muted-foreground/40" />
        <p className="mt-4">{t("treeView.folderEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-1">
      {nodes.map((node, index) => (
        <TreeNode
          key={node.object.key}
          node={node}
          depth={0}
          path={[index]}
          isLast={index === nodes.length - 1 && !rootTruncated}
          parentIsLast={[]}
          selected={selectedKeys?.has(node.object.key) ?? false}
          onToggle={toggleNode}
          onNodeClick={handleNodeClick}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          onDownload={onDownload}
          onCopyLink={onCopyLink}
          onDelete={onDelete}
          onEnterFolder={onEnterFolder}
          onLoadMore={loadMoreChildren}
          onEnterBucket={onEnterBucket}
          onBucketSettings={onBucketSettings}
          onDeleteBucket={onDeleteBucket}
          t={t}
        />
      ))}

      {/* Invisible sentinel for lazy loading more root items */}
      {rootTruncated && (
        <div ref={loadMoreSentinelRef} className="h-8 flex items-center justify-center">
          {rootLoadingMore && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}

type TreeNodeProps = {
  node: TreeNodeData;
  depth: number;
  path: number[];
  isLast: boolean;
  parentIsLast: boolean[];
  selected: boolean;
  onToggle: (path: number[]) => void;
  onNodeClick: (e: React.MouseEvent, key: string, isBucket?: boolean) => void;
  onToggleSelect?: (key: string) => void;
  onPreview?: (key: string) => void;
  onDownload?: (key: string) => void;
  onCopyLink?: (key: string) => void;
  onDelete?: (key: string) => void;
  onEnterFolder: (key: string) => void;
  onLoadMore: (path: number[]) => void;

  onEnterBucket?: (name: string) => void;
  onBucketSettings?: (name: string) => void;
  onDeleteBucket?: (name: string) => void;

  t: (key: string) => string;
};

const TreeNode = memo(
  function TreeNodeInner({
    node,
    depth,
    path,
    isLast,
    parentIsLast,
    selected,
    onToggle,
    onNodeClick,
    onToggleSelect,
    onPreview,
    onDownload,
    onCopyLink,
    onDelete,
    onEnterFolder,
    onLoadMore,
    onEnterBucket,
    onBucketSettings,
    onDeleteBucket,
    t,
  }: TreeNodeProps) {
    const { object, children, state, parentPrefix, isBucketRoot } = node;
    const isDir = object.isDir;
    // For buckets, the label is the key (name). For objects, derive from prefix.
    const label = isBucketRoot ? object.key : deriveLabel(object.key, parentPrefix);

    // Ref for lazy loading sentinel
    const sentinelRef = useRef<HTMLDivElement>(null);

    // Intersection observer for lazy loading children
    useEffect(() => {
      if (!node.truncated || state !== "expanded" || !sentinelRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !node.loadingMore) {
            onLoadMore(path);
          }
        },
        { threshold: 0.1, rootMargin: "50px" },
      );

      observer.observe(sentinelRef.current);
      return () => observer.disconnect();
    }, [node.truncated, node.loadingMore, state, path, onLoadMore]);

    const handleClick = (e: React.MouseEvent) => {
      // If clicking the checkbox area, let it handle itself
      if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
        return;
      }
      // Otherwise, handle selection
      onNodeClick(e, object.key, isBucketRoot);
    };

    const handleToggleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isDir) {
        onToggle(path);
      }
    };

    const menuItems = isBucketRoot ? (
      <BucketContextMenuItems
        bucketName={object.key}
        onEnter={onEnterBucket!}
        onSettings={onBucketSettings}
        onDelete={onDeleteBucket!}
      />
    ) : (
      <FileContextMenuItems
        itemKey={object.key}
        isDir={isDir}
        onEnter={onEnterFolder}
        onPreview={onPreview!}
        onDownload={onDownload!}
        onCopyLink={onCopyLink!}
        onDelete={onDelete!}
      />
    );

    const icon = isBucketRoot ? (
      <DatabaseZap className="h-4 w-4 text-primary" />
    ) : isDir ? (
      <Folder className="h-4 w-4 text-primary" />
    ) : (
      getFileIcon(object.key, "h-4 w-4")
    );

    const chevron = isDir ? (
      state === "loading" ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : state === "expanded" ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      )
    ) : (
      <span className="w-4" />
    );

    // Calculate the left padding based on depth (each level = 20px)
    const indentPadding = depth * 20;

    return (
      <>
        <ContextMenu>
          <ContextMenuTrigger>
            <div
              onClick={handleClick}
              className={cn(
                "flex items-center gap-1 w-full py-1 rounded-sm transition-colors",
                "hover:bg-accent/60",
                selected && "bg-accent",
              )}
              style={{
                minHeight: "28px",
                paddingLeft: indentPadding + 8,
                paddingRight: 8,
              }}
            >
              {/* Expand/Collapse chevron */}
              <div
                onClick={handleToggleClick}
                className="flex items-center justify-center shrink-0"
              >
                {chevron}
              </div>

              {/* Checkbox - only for objects */}
              {!isBucketRoot && onToggleSelect && (
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(object.key)}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0"
                />
              )}

              {/* Icon */}
              <span className="flex items-center justify-center shrink-0">{icon}</span>

              {/* Label */}
              <span className="truncate text-sm font-medium flex-1">{label}</span>

              {/* Symlink indicator */}
              {!isBucketRoot && object.isSymlink && (
                <Link2 className="h-3 w-3 text-primary shrink-0" />
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>{menuItems}</ContextMenuContent>
        </ContextMenu>

        {state === "expanded" && (
          <div className="relative">
            {/* Continuous vertical line spanning all children */}
            <div
              className="absolute w-px bg-border"
              style={{
                left: indentPadding + 8 + 7, // align with chevron center
                top: 0,
                bottom: 0,
              }}
            />
            {children.map((child, index) => {
              const childIsLast = index === children.length - 1 && !node.truncated;
              return (
                <TreeNode
                  key={child.object.key}
                  node={child}
                  depth={depth + 1}
                  path={[...path, index]}
                  isLast={childIsLast}
                  parentIsLast={[...parentIsLast, isLast]}
                  selected={!child.isBucketRoot && onToggleSelect ? selected : false} // Selection logic needs fix maybe?
                  onToggle={onToggle}
                  onNodeClick={onNodeClick}
                  onToggleSelect={onToggleSelect}
                  onPreview={onPreview}
                  onDownload={onDownload}
                  onCopyLink={onCopyLink}
                  onDelete={onDelete}
                  onEnterFolder={onEnterFolder}
                  onLoadMore={onLoadMore}
                  onEnterBucket={onEnterBucket}
                  onBucketSettings={onBucketSettings}
                  onDeleteBucket={onDeleteBucket}
                  t={t}
                />
              );
            })}
            {node.truncated && (
              <div
                ref={sentinelRef}
                className="h-6 flex items-center"
                style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}
              >
                {node.loadingMore && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to avoid unnecessary re-renders
    return (
      prevProps.selected === nextProps.selected &&
      prevProps.node === nextProps.node &&
      prevProps.depth === nextProps.depth &&
      prevProps.isLast === nextProps.isLast &&
      prevProps.path.length === nextProps.path.length &&
      prevProps.path.every((v, i) => v === nextProps.path[i]) &&
      prevProps.parentIsLast.length === nextProps.parentIsLast.length &&
      prevProps.parentIsLast.every((v, i) => v === nextProps.parentIsLast[i])
    );
  },
);

// Helper functions (same as before)
function getNodeByPath(nodes: TreeNodeData[], path: number[]): TreeNodeData | null {
  if (path.length === 0) return null;
  let current = nodes[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (!current?.children) return null;
    current = current.children[path[i]];
  }
  return current ?? null;
}

function updateNodeByPath(
  nodes: TreeNodeData[],
  path: number[],
  updates: Partial<TreeNodeData>,
): TreeNodeData[] {
  if (path.length === 0) return nodes;

  return nodes.map((node, index) => {
    if (index !== path[0]) return node;

    if (path.length === 1) {
      return { ...node, ...updates };
    }

    return {
      ...node,
      children: updateNodeByPath(node.children, path.slice(1), updates),
    };
  });
}
