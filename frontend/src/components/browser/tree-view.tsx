import { Checkbox } from "@/components/ui/checkbox";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { isBridgeAvailable } from "@/lib/bridge";
import { cn } from "@/lib/utils";
import { ListObjects } from "@wailsjs/go/app/App";
import type { objects as ObjectModels } from "@wailsjs/go/models";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  Folder,
  Link2,
  Loader2,
  Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { deriveLabel, getFileIcon } from "./file-utils";

export type TreeObject = ObjectModels.ObjectInfo;

export type TreeViewProps = {
  accountId: string;
  bucket: string;
  initialPrefix?: string;
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  onSelectAll: (keys: string[]) => void;
  onClearSelection: () => void;
  onPreview: (key: string) => void;
  onDownload: (key: string) => void;
  onCopyLink: (key: string) => void;
  onDelete: (key: string) => void;
  onEnterFolder: (key: string) => void;
};

type NodeState = "collapsed" | "loading" | "expanded";

type TreeNodeData = {
  object: TreeObject;
  children: TreeNodeData[];
  state: NodeState;
  parentPrefix: string;
};

export function TreeView({
  accountId,
  bucket,
  initialPrefix = "",
  selectedKeys,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
  onEnterFolder,
}: TreeViewProps) {
  const [nodes, setNodes] = useState<TreeNodeData[]>([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootLoaded, setRootLoaded] = useState(false);
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);

  // Load root level on first render
  const loadRoot = useCallback(async () => {
    if (rootLoaded || rootLoading) return;
    setRootLoading(true);
    try {
      const objects = await loadPrefix(accountId, bucket, initialPrefix);
      setNodes(
        objects.map((obj) => ({
          object: obj,
          children: [],
          state: "collapsed" as NodeState,
          parentPrefix: initialPrefix,
        })),
      );
      setRootLoaded(true);
    } finally {
      setRootLoading(false);
    }
  }, [accountId, bucket, initialPrefix, rootLoaded, rootLoading]);

  // Auto-load root
  if (!rootLoaded && !rootLoading) {
    void loadRoot();
  }

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
  const handleNodeClick = (e: React.MouseEvent, key: string) => {
    if (e.shiftKey && lastSelectedKey) {
      // Shift+Click: Range selection
      const allKeys = getAllVisibleKeys();
      const lastIndex = allKeys.indexOf(lastSelectedKey);
      const currentIndex = allKeys.indexOf(key);

      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const keysToSelect = allKeys.slice(start, end + 1);
        onSelectAll(keysToSelect);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: Toggle individual item
      onToggleSelect(key);
      setLastSelectedKey(key);
    } else {
      // Plain click
      const isSelected = selectedKeys.has(key);
      const isOnlyOne = selectedKeys.size === 1 && isSelected;

      if (isOnlyOne) {
        onClearSelection();
        setLastSelectedKey(null);
      } else {
        onClearSelection();
        onToggleSelect(key);
        setLastSelectedKey(key);
      }
    }
  };

  const toggleNode = async (path: number[]) => {
    const node = getNodeByPath(nodes, path);
    if (!node || !node.object.isDir) return;

    if (node.state === "expanded") {
      // Collapse
      setNodes((prev) => updateNodeByPath(prev, path, { state: "collapsed" }));
    } else if (node.state === "collapsed") {
      // Expand - load children if not loaded
      setNodes((prev) => updateNodeByPath(prev, path, { state: "loading" }));
      try {
        const children = await loadPrefix(accountId, bucket, node.object.key);
        setNodes((prev) =>
          updateNodeByPath(prev, path, {
            state: "expanded",
            children: children.map((obj) => ({
              object: obj,
              children: [],
              state: "collapsed" as NodeState,
              parentPrefix: node.object.key,
            })),
          }),
        );
      } catch {
        setNodes((prev) => updateNodeByPath(prev, path, { state: "collapsed" }));
      }
    }
  };

  if (rootLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载中...
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Folder className="h-12 w-12 text-muted-foreground/40" />
        <p className="mt-4">文件夹为空</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {nodes.map((node, index) => (
        <TreeNode
          key={node.object.key}
          node={node}
          depth={0}
          path={[index]}
          selected={selectedKeys.has(node.object.key)}
          selectedKeys={selectedKeys}
          onToggle={toggleNode}
          onNodeClick={handleNodeClick}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          onDownload={onDownload}
          onCopyLink={onCopyLink}
          onDelete={onDelete}
          onEnterFolder={onEnterFolder}
        />
      ))}
    </div>
  );
}

type TreeNodeProps = {
  node: TreeNodeData;
  depth: number;
  path: number[];
  selected: boolean;
  selectedKeys: Set<string>;
  onToggle: (path: number[]) => void;
  onNodeClick: (e: React.MouseEvent, key: string) => void;
  onToggleSelect: (key: string) => void;
  onPreview: (key: string) => void;
  onDownload: (key: string) => void;
  onCopyLink: (key: string) => void;
  onDelete: (key: string) => void;
  onEnterFolder: (key: string) => void;
};

function TreeNode({
  node,
  depth,
  path,
  selected,
  selectedKeys,
  onToggle,
  onNodeClick,
  onToggleSelect,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
  onEnterFolder,
}: TreeNodeProps) {
  const { object, children, state, parentPrefix } = node;
  const isDir = object.isDir;
  const label = deriveLabel(object.key, parentPrefix);

  const handleClick = (e: React.MouseEvent) => {
    // If clicking the checkbox area, let it handle itself
    if ((e.target as HTMLElement).closest('[role="checkbox"]')) {
      return;
    }
    // Otherwise, handle selection
    onNodeClick(e, object.key);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) {
      onToggle(path);
    }
  };

  const menuItems = (
    <>
      {isDir ? (
        <ContextMenuItem onClick={() => onEnterFolder(object.key)}>
          <Folder className="mr-2 h-4 w-4" />
          进入
        </ContextMenuItem>
      ) : (
        <>
          <ContextMenuItem onClick={() => onPreview(object.key)}>
            <Eye className="mr-2 h-4 w-4" />
            预览
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDownload(object.key)}>
            <Download className="mr-2 h-4 w-4" />
            下载
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyLink(object.key)}>
            <Link2 className="mr-2 h-4 w-4" />
            复制链接
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => onDelete(object.key)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        删除
      </ContextMenuItem>
    </>
  );

  const icon = isDir ? (
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

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            onClick={handleClick}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 rounded-md transition-colors",
              "hover:bg-accent/60",
              selected && "bg-accent",
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <div onClick={handleToggleClick} className="flex items-center justify-center shrink-0">
              {chevron}
            </div>
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleSelect(object.key)}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            />
            <span className="flex items-center justify-center shrink-0">{icon}</span>
            <span className="truncate text-sm font-medium flex-1">{label}</span>
            {object.isSymlink && <Link2 className="h-3 w-3 text-primary shrink-0" />}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>{menuItems}</ContextMenuContent>
      </ContextMenu>

      {state === "expanded" &&
        children.map((child, index) => (
          <TreeNode
            key={child.object.key}
            node={child}
            depth={depth + 1}
            path={[...path, index]}
            selected={selectedKeys.has(child.object.key)}
            selectedKeys={selectedKeys}
            onToggle={onToggle}
            onNodeClick={onNodeClick}
            onToggleSelect={onToggleSelect}
            onPreview={onPreview}
            onDownload={onDownload}
            onCopyLink={onCopyLink}
            onDelete={onDelete}
            onEnterFolder={onEnterFolder}
          />
        ))}
    </>
  );
}

// Helper functions
async function loadPrefix(
  accountId: string,
  bucket: string,
  prefix: string,
): Promise<TreeObject[]> {
  if (!isBridgeAvailable()) {
    return [];
  }
  const result = await ListObjects(accountId, {
    bucket,
    prefix,
    delimiter: "/",
    limit: 1000,
    marker: "",
  });
  return result.objects.filter((obj) => obj.key !== prefix);
}

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
