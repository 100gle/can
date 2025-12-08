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
  Share2,
  Trash2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { deriveLabel, getFileIcon } from "./file-utils";

export type TreeObject = ObjectModels.ObjectInfo;

export type TreeViewProps = {
  accountId: string;
  bucket: string;
  initialPrefix?: string;
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
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
  onEnterFolder,
}: TreeViewProps) {
  const [nodes, setNodes] = useState<TreeNodeData[]>([]);
  const [rootLoading, setRootLoading] = useState(false);
  const [rootLoaded, setRootLoaded] = useState(false);

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
          onToggle={toggleNode}
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
  onToggle: (path: number[]) => void;
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
  onToggle,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
  onEnterFolder,
}: TreeNodeProps) {
  const { object, children, state, parentPrefix } = node;
  const isDir = object.isDir;
  // Use parentPrefix to derive just the current node name, not full path
  const label = deriveLabel(object.key, parentPrefix);

  const handleClick = () => {
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
          <ContextMenuItem onClick={() => onCopyLink(object.key)}>
            <Share2 className="mr-2 h-4 w-4" />
            分享
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
          <button
            type="button"
            onClick={handleClick}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-left rounded-md transition-colors",
              "hover:bg-accent/60",
              isDir && "cursor-pointer",
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {chevron}
            <span className="flex items-center justify-center">{icon}</span>
            <span className="truncate text-sm font-medium flex-1">{label}</span>
            {object.isSymlink && <Link2 className="h-3 w-3 text-primary shrink-0" />}
          </button>
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
            onToggle={onToggle}
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
