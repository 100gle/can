import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveFileDialog } from "@/lib/bridge";
import { cn } from "@/lib/utils";
import { bucketsStore, useBucketsStore } from "@/state/buckets";
import { objectsStore, useObjectsStore } from "@/state/objects";
import { transfersStore } from "@/state/transfers";
import { GetPresignedDownloadURL } from "@wailsjs/go/main/App";
import {
  ArrowLeft,
  Download,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileText,
  Filter,
  Folder,
  FolderPlus,
  HardDrive,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Share2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type FileExplorerProps = {
  accountId?: string;
  providerId?: string;
  onOpenBucketSettings?: (bucket: string) => void;
  className?: string;
};

type BrowseLevel = "buckets" | "objects";

export function FileExplorer({
  accountId,
  providerId,
  onOpenBucketSettings,
  className,
}: FileExplorerProps) {
  // Bucket state
  const {
    buckets,
    loading: bucketsLoading,
    creating,
    deleting,
    error: bucketsError,
  } = useBucketsStore((state) => state);

  // Object state
  const {
    objects,
    loading: objectsLoading,
    loadingMore,
    uploading,
    error: objectsError,
    prefix,
    truncated,
    pendingKeys,
  } = useObjectsStore((state) => state);

  // Browser state
  const [level, setLevel] = useState<BrowseLevel>("buckets");
  const [currentBucket, setCurrentBucket] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Dialog states
  const [createBucketOpen, setCreateBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketRegion, setNewBucketRegion] = useState("us-east-1");
  const [pendingDeleteBucket, setPendingDeleteBucket] = useState<string | null>(null);
  const [pendingDeleteObject, setPendingDeleteObject] = useState<string | null>(null);

  // Upload refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Drag state
  const [dragActive, setDragActive] = useState(false);

  // Load buckets and reset state when account changes
  useEffect(() => {
    if (accountId) {
      // Reset browser state to root level when account changes
      setLevel("buckets");
      setCurrentBucket(null);
      setSearchTerm("");
      setTypeFilter("all");
      // Clear objects store context to prevent stale data
      objectsStore.reset();
      // Load new account's buckets
      void bucketsStore.loadBuckets(accountId);
    }
  }, [accountId]);

  // Set folder input webkitdirectory
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "true");
    }
  }, []);

  // Loading state
  const loading = level === "buckets" ? bucketsLoading : objectsLoading;
  const error = level === "buckets" ? bucketsError : objectsError;

  // Build breadcrumbs
  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; onClick?: () => void }[] = [
      { label: "根目录", onClick: () => handleGoToRoot() },
    ];
    if (currentBucket) {
      crumbs.push({
        label: currentBucket,
        onClick: prefix ? () => handleGoToBucket(currentBucket) : undefined,
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
  }, [currentBucket, prefix]);

  // Filter items
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

  const hasActiveFilters = searchTerm || typeFilter !== "all";

  // Navigation
  const handleGoToRoot = () => {
    setLevel("buckets");
    setCurrentBucket(null);
    setSearchTerm("");
    setTypeFilter("all");
  };

  const handleGoToBucket = (bucketName: string) => {
    if (!accountId) return;
    setCurrentBucket(bucketName);
    setLevel("objects");
    setSearchTerm("");
    setTypeFilter("all");
    void objectsStore.setContext(accountId, bucketName);
  };

  const handleEnterFolder = (key: string) => {
    void objectsStore.enterPrefix(key.endsWith("/") ? key : `${key}/`);
  };

  const handleGoUp = () => {
    if (level === "objects" && !prefix) {
      handleGoToRoot();
    } else if (level === "objects" && prefix) {
      void objectsStore.goUp();
    }
  };

  // Bucket actions
  const handleCreateBucket = async () => {
    if (!accountId || !newBucketName.trim()) return;
    try {
      await bucketsStore.createBucket(accountId, newBucketName.trim(), newBucketRegion.trim());
      setCreateBucketOpen(false);
      setNewBucketName("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBucket = async () => {
    if (!accountId || !pendingDeleteBucket) return;
    try {
      await bucketsStore.deleteBucket(accountId, pendingDeleteBucket);
    } finally {
      setPendingDeleteBucket(null);
    }
  };

  // Object actions
  const handleDownload = async (key: string) => {
    const defaultName = key.split("/").pop() || "file";
    const savePath = await saveFileDialog({ Title: "保存文件", DefaultFilename: defaultName });
    if (!savePath) return;
    await objectsStore.downloadToPath(key, savePath);
  };

  const handleCopyLink = async (key: string) => {
    if (!accountId || !currentBucket) return;
    try {
      const url = await GetPresignedDownloadURL(accountId, currentBucket, key, 60);
      await navigator.clipboard.writeText(url);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteObject = async () => {
    if (!pendingDeleteObject) return;
    try {
      await objectsStore.deleteObject(pendingDeleteObject);
    } finally {
      setPendingDeleteObject(null);
    }
  };

  // Upload
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (!files?.length || !accountId || !currentBucket) return;
    await transfersStore.uploadFiles(Array.from(files), {
      accountId,
      bucket: currentBucket,
      prefix,
    });
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (!accountId || !currentBucket) return;
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) {
      void transfersStore.uploadFiles(files, { accountId, bucket: currentBucket, prefix });
    }
  };

  // Refresh
  const handleRefresh = () => {
    if (level === "buckets") {
      void bucketsStore.refresh();
    } else {
      void objectsStore.refresh();
    }
  };

  // Render item
  const renderItem = (item: any, index: number) => {
    if (level === "buckets") {
      return (
        <ContextMenu key={item.name}>
          <ContextMenuTrigger>
            <button
              type="button"
              onClick={() => handleGoToBucket(item.name)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-4 transition-all w-full text-left",
                "hover:border-primary/50 hover:bg-accent/50 hover:shadow-md",
                viewMode === "grid" ? "flex-col text-center" : "",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-lg bg-primary/10 transition-transform group-hover:scale-110",
                  viewMode === "grid" ? "h-16 w-16" : "h-10 w-10",
                )}
              >
                <HardDrive
                  className={cn("text-primary", viewMode === "grid" ? "h-8 w-8" : "h-5 w-5")}
                />
              </div>
              <div className={cn("min-w-0", viewMode === "grid" ? "w-full" : "flex-1")}>
                <p className="truncate font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.region || "未知区域"}
                </p>
              </div>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => handleGoToBucket(item.name)}>
              <Folder className="mr-2 h-4 w-4" />
              进入
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onOpenBucketSettings?.(item.name)}>
              <Settings2 className="mr-2 h-4 w-4" />
              设置
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => setPendingDeleteBucket(item.name)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    } else {
      const label = deriveLabel(item.key, prefix);
      const isDir = item.isDir;

      return (
        <ContextMenu key={item.key}>
          <ContextMenuTrigger>
            <button
              type="button"
              onClick={() => (isDir ? handleEnterFolder(item.key) : undefined)}
              className={cn(
                "group flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-4 transition-all w-full text-left",
                "hover:border-primary/50 hover:bg-accent/50 hover:shadow-md",
                viewMode === "grid" ? "flex-col text-center" : "",
                !isDir && "cursor-default",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center rounded-lg transition-transform group-hover:scale-110",
                  isDir ? "bg-primary/10" : "bg-muted/50",
                  viewMode === "grid" ? "h-16 w-16" : "h-10 w-10",
                )}
              >
                {isDir ? (
                  <Folder
                    className={cn("text-primary", viewMode === "grid" ? "h-8 w-8" : "h-5 w-5")}
                  />
                ) : (
                  getFileIcon(item.key, viewMode === "grid" ? "h-8 w-8" : "h-5 w-5")
                )}
              </div>
              <div className={cn("min-w-0", viewMode === "grid" ? "w-full" : "flex-1")}>
                <p className="truncate font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isDir ? "文件夹" : formatSize(item.size)}
                </p>
              </div>
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {isDir ? (
              <ContextMenuItem onClick={() => handleEnterFolder(item.key)}>
                <Folder className="mr-2 h-4 w-4" />
                进入
              </ContextMenuItem>
            ) : (
              <>
                <ContextMenuItem onClick={() => handleDownload(item.key)}>
                  <Download className="mr-2 h-4 w-4" />
                  下载
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyLink(item.key)}>
                  <Link2 className="mr-2 h-4 w-4" />
                  复制链接
                </ContextMenuItem>
                <ContextMenuItem onClick={() => handleCopyLink(item.key)}>
                  <Share2 className="mr-2 h-4 w-4" />
                  分享
                </ContextMenuItem>
              </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => setPendingDeleteObject(item.key)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      );
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleFilesSelected}
      />
      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleFilesSelected}
      />

      <Card className={cn("flex h-full flex-col", className)}>
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">文件浏览器</p>
              <h3 className="text-lg font-semibold">
                {level === "buckets" ? "存储桶" : currentBucket}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleRefresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                刷新
              </Button>
              {level === "objects" && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    上传
                  </Button>
                </>
              )}
              {level === "buckets" && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1"
                  onClick={() => setCreateBucketOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  新建桶
                </Button>
              )}
            </div>
          </div>

          {/* Search and filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={level === "buckets" ? "搜索存储桶..." : "搜索文件..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {level === "objects" && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="folder">文件夹</SelectItem>
                  <SelectItem value="image">图片</SelectItem>
                  <SelectItem value="document">文档</SelectItem>
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center rounded-md border border-border/40">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center justify-between">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, i) => {
                  const isLast = i === breadcrumbs.length - 1;
                  return (
                    <BreadcrumbItem key={i}>
                      {isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button type="button" onClick={crumb.onClick}>
                            {crumb.label}
                          </button>
                        </BreadcrumbLink>
                      )}
                      {!isLast && <BreadcrumbSeparator />}
                    </BreadcrumbItem>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
            {(level === "objects" || currentBucket) && (
              <Button variant="ghost" size="sm" className="gap-1" onClick={handleGoUp}>
                <ArrowLeft className="h-3 w-3" />
                返回
              </Button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && <p className="px-4 pt-2 text-sm text-destructive">{error}</p>}

        {/* Content with context menu on background */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className="flex-1 overflow-auto p-4"
              onDragOver={(e) => {
                e.preventDefault();
                if (level === "objects") setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              {dragActive && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-background/90">
                  <div className="text-center">
                    <Upload className="mx-auto h-10 w-10 text-primary" />
                    <p className="mt-2 font-medium">释放以上传</p>
                  </div>
                </div>
              )}

              {loading && filteredItems.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  加载中...
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Folder className="h-12 w-12 text-muted-foreground/40" />
                  <p className="mt-4 text-muted-foreground">
                    {hasActiveFilters
                      ? "没有匹配的项目"
                      : level === "buckets"
                        ? "暂无存储桶"
                        : "文件夹为空"}
                  </p>
                  {hasActiveFilters && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setSearchTerm("");
                        setTypeFilter("all");
                      }}
                    >
                      清除过滤
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  className={cn(
                    viewMode === "grid"
                      ? "grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                      : "flex flex-col gap-2",
                  )}
                >
                  {filteredItems.map((item, i) => renderItem(item, i))}
                </div>
              )}

              {level === "objects" && truncated && (
                <div className="mt-4 text-center">
                  <Button
                    variant="outline"
                    onClick={() => objectsStore.loadMore()}
                    disabled={loadingMore}
                  >
                    {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {level === "buckets" ? (
              <ContextMenuItem onClick={() => setCreateBucketOpen(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                新建存储桶
              </ContextMenuItem>
            ) : (
              <>
                <ContextMenuItem onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  上传文件
                </ContextMenuItem>
                <ContextMenuItem onClick={() => folderInputRef.current?.click()}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  上传文件夹
                </ContextMenuItem>
              </>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleRefresh}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              刷新
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </Card>

      {/* Create Bucket Dialog */}
      <Dialog open={createBucketOpen} onOpenChange={setCreateBucketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建存储桶</DialogTitle>
            <DialogDescription>创建一个新的存储桶来存放您的文件。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                placeholder="my-bucket"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>区域</Label>
              <Input
                placeholder="us-east-1"
                value={newBucketRegion}
                onChange={(e) => setNewBucketRegion(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBucketOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateBucket} disabled={creating || !newBucketName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Bucket Dialog */}
      <AlertDialog
        open={!!pendingDeleteBucket}
        onOpenChange={(o) => !o && setPendingDeleteBucket(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除存储桶</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除 "{pendingDeleteBucket}"？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBucket}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Object Dialog */}
      <AlertDialog
        open={!!pendingDeleteObject}
        onOpenChange={(o) => !o && setPendingDeleteObject(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文件</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除 "{pendingDeleteObject}"？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteObject}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Helpers
const deriveLabel = (key: string, prefix: string) => {
  const base = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return base.replace(/\/$/, "");
};

const formatSize = (size?: number) => {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const getFileIcon = (key: string, sizeClass: string) => {
  const ext = key.split(".").pop()?.toLowerCase() || "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return <FileImage className={cn(sizeClass, "text-pink-500")} />;
  }
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) {
    return <FileText className={cn(sizeClass, "text-blue-500")} />;
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <FileArchive className={cn(sizeClass, "text-amber-500")} />;
  }
  if (["js", "ts", "jsx", "tsx", "py", "go", "json", "xml", "html", "css"].includes(ext)) {
    return <FileCode className={cn(sizeClass, "text-cyan-500")} />;
  }
  return <File className={cn(sizeClass, "text-muted-foreground")} />;
};
