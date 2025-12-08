import { FilePreviewModal } from "@/components/objects/file-preview-modal";
import { SearchPanel } from "@/components/search/search-panel";
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
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isBridgeAvailable, saveFileDialog } from "@/lib/bridge";
import { cn } from "@/lib/utils";
import { useAccountsStore } from "@/state/accounts";
import { bucketsStore, useBucketsStore } from "@/state/buckets";
import { objectsStore, useObjectsStore, type ObjectModel } from "@/state/objects";
import { transfersStore } from "@/state/transfers";
import { GetPresignedDownloadURL } from "@wailsjs/go/app/App";
import {
  Download,
  Folder,
  FolderPlus,
  FolderTree,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MoreHorizontal,
  Move,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  WifiOff,
  X
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import { BucketItem } from "./bucket-item";
import { CreateBucketDialog } from "./create-bucket-dialog";
import { FileItem } from "./file-item";
import { FileTable } from "./file-table";
import { SymlinkDialog } from "./symlink-dialog";
import { TreeView } from "./tree-view";

type FileExplorerProps = {
  accountId?: string;
  onOpenBucketSettings?: (bucket: string) => void;
  className?: string;
};

type BrowseLevel = "buckets" | "objects" | "search";

export function FileExplorer({ accountId, onOpenBucketSettings, className }: FileExplorerProps) {
  // Bucket state - use individual selectors for React 19 compatibility
  const buckets = useBucketsStore((state) => state.buckets);
  const bucketsLoading = useBucketsStore((state) => state.loading);
  const bucketsError = useBucketsStore((state) => state.error);

  // Object state - use individual selectors for React 19 compatibility
  const objects = useObjectsStore((state) => state.objects);
  const objectsLoading = useObjectsStore((state) => state.loading);
  const loadingMore = useObjectsStore((state) => state.loadingMore);
  const uploading = useObjectsStore((state) => state.uploading);
  const objectsError = useObjectsStore((state) => state.error);
  const prefix = useObjectsStore((state) => state.prefix);
  const truncated = useObjectsStore((state) => state.truncated);
  const objectsIsFromCache = useObjectsStore((state) => state.isFromCache);
  const objectsLastSync = useObjectsStore((state) => state.lastSync);
  const selectedKeys = useObjectsStore((state) => state.selectedKeys);

  // Bucket cache state
  const bucketsIsFromCache = useBucketsStore((state) => state.isFromCache);
  const bucketsLastSync = useBucketsStore((state) => state.lastSync);

  // Use individual selectors to avoid new object reference issue with React 19
  const accounts = useAccountsStore((state) => state.accounts);
  const capabilities = useAccountsStore((state) => state.capabilities);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === accountId),
    [accounts, accountId],
  );
  const providerId = activeAccount?.provider?.toLowerCase();
  const isOSSProvider = providerId === "oss";
  const isCOSProvider = providerId === "cos";
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
  const [viewMode, setViewMode] = useState<"list" | "grid" | "tree">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // View mode change handler - list uses flat mode (no hierarchy), grid uses folder hierarchy
  const handleViewModeChange = (mode: "list" | "grid" | "tree") => {
    setViewMode(mode);
    if (level === "objects" && mode !== "tree") {
      // list = flat mode (empty delimiter, all objects)
      // grid = folder hierarchy (delimiter "/")
      const newDelimiter = mode === "list" ? "" : "/";
      void objectsStore.setDelimiter(newDelimiter);
    }
  };

  // Dialog states (simplified - form state is now in extracted components)
  const [createBucketOpen, setCreateBucketOpen] = useState(false);
  const [pendingDeleteBucket, setPendingDeleteBucket] = useState<string | null>(null);
  const [pendingDeleteObject, setPendingDeleteObject] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewObject, setPreviewObject] = useState<ObjectModel | null>(null);
  const [symlinkDialogOpen, setSymlinkDialogOpen] = useState(false);

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

  const handleGoToBucket = async (bucketName: string) => {
    if (!accountId) return;
    setCurrentBucket(bucketName);
    setLevel("objects");
    setSearchTerm("");
    setTypeFilter("all");
    // Set delimiter based on current viewMode before loading objects
    // list = flat mode (empty delimiter), grid = folder hierarchy
    const delimiter = viewMode === "list" ? "" : "/";
    await objectsStore.setDelimiter(delimiter);
    void objectsStore.setContext(accountId, bucketName);
    objectsStore.clearSelection();
  };

  const handleEnterFolder = (key: string) => {
    void objectsStore.enterPrefix(key.endsWith("/") ? key : `${key}/`);
  };

  const handleDeleteBucket = async () => {
    if (!accountId || !pendingDeleteBucket) return;
    try {
      await bucketsStore.deleteBucket(accountId, pendingDeleteBucket);
    } finally {
      setPendingDeleteBucket(null);
    }
  };

  const handleDownload = async (key: string) => {
    console.log("[Download] Starting download for key:", key);

    if (!accountId || !currentBucket) {
      setErrorMessage("请先选择账户和存储桶");
      setErrorDialogOpen(true);
      return;
    }

    try {
      const defaultName = key.split("/").pop() || "file";

      // Check if we're in desktop mode
      if (isBridgeAvailable()) {
        // Desktop mode: use file dialog
        console.log("[Download] Desktop mode - opening save dialog");
        const savePath = await saveFileDialog({ Title: "保存文件", DefaultFilename: defaultName });

        if (!savePath) {
          console.log("[Download] User cancelled save dialog");
          return;
        }

        console.log("[Download] Calling objectsStore.downloadToPath");
        await objectsStore.downloadToPath(key, savePath);
        console.log("[Download] Download task created successfully");
      } else {
        // Web mode: use browser native download
        console.log("[Download] Web mode - using presigned URL download");
        const url = await GetPresignedDownloadURL(accountId, currentBucket, key, 300); // 5 min expiry

        // Create temporary link and trigger download
        const link = document.createElement("a");
        link.href = url;
        link.download = defaultName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log("[Download] Browser download initiated");
      }
    } catch (e) {
      console.error("[Download] Error occurred:", e);
      const message = e instanceof Error ? e.message : "下载失败";
      setErrorMessage(message);
      setErrorDialogOpen(true);
    }
  };

  const [_copiedText, copyToClipboard] = useCopyToClipboard();

  const handleCopyLink = async (key: string) => {
    if (!accountId || !currentBucket) return;
    try {
      const url = await GetPresignedDownloadURL(accountId, currentBucket, key, 60);

      copyToClipboard(url)
        .then(() => {
          // Show success toast
          toast.success("链接已复制", {
            description: "下载链接已复制到剪贴板",
            duration: 2000,
          });
        })
        .catch(() => {
          setErrorMessage("复制失败，请手动复制链接");
          setErrorDialogOpen(true);
        });
    } catch (e) {
      const message = e instanceof Error ? e.message : "获取下载链接失败";
      setErrorMessage(message);
      setErrorDialogOpen(true);
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

  const handlePreview = (key: string) => {
    const target = objects.find((obj) => obj.key === key && !obj.isDir);
    if (!target) {
      toast.error("请选择可预览的文件");
      return;
    }
    setPreviewObject(target);
    setPreviewOpen(true);
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

  // Render content based on view mode
  const renderContent = () => {
    if (loading && filteredItems.length === 0) {
      return (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          加载中...
        </div>
      );
    }
    
    if (filteredItems.length === 0) {
      return (
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
      );
    }

    if (level === "buckets") {
      return (
         <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 120px))" }}>
            {filteredItems.map((item) => (
                <BucketItem
                  key={(item as any).name}
                  bucket={item as any}
                  viewMode="grid"
                  onEnter={handleGoToBucket}
                  onSettings={onOpenBucketSettings}
                  onDelete={(name) => setPendingDeleteBucket(name)}
                />
            ))}
         </div>
      );
    }

    // Objects view
    if (viewMode === "list") {
        return (
            <FileTable
                data={filteredItems as ObjectModel[]} // Type safe because level is objects
                prefix={prefix}
                selectedKeys={selectedKeys}
                onToggleSelect={objectsStore.toggleSelect}
                onSelectAll={objectsStore.selectAll}
                onClearSelection={objectsStore.clearSelection}
                onEnterFolder={handleEnterFolder}
                onPreview={handlePreview}
                onDownload={handleDownload}
                onCopyLink={handleCopyLink}
                onDelete={(key) => setPendingDeleteObject(key)}
            />
        );
    }

    if (viewMode === "tree") {
         return (
             <TreeView
                accountId={accountId!}
                bucket={currentBucket!}
                initialPrefix={prefix}
                onPreview={handlePreview}
                onDownload={handleDownload}
                onCopyLink={handleCopyLink}
                onDelete={(key) => setPendingDeleteObject(key)}
                onEnterFolder={handleEnterFolder}
             />
         );
    }

    // Grid view (old renderItem loop)
    return (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 120px))" }}
        >
          {filteredItems.map((item) => (
             <FileItem
               key={(item as any).key}
               object={item as any}
               prefix={prefix}
               viewMode="grid"
               selected={selectedKeys.has((item as any).key)}
               onToggleSelect={objectsStore.toggleSelect}
               onEnterFolder={handleEnterFolder}
               onPreview={handlePreview}
               onDownload={handleDownload}
               onCopyLink={handleCopyLink}
               onDelete={(key) => setPendingDeleteObject(key)}
             />
          ))}
        </div>
    );
  };

  return (
    <TooltipProvider>
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
        {/* Unified Toolbar */}
        <div className="flex h-14 items-center border-b border-border/40 px-4">
          {/* Breadcrumbs - 2/3 Width */}
          <div className="w-2/3 overflow-x-auto whitespace-nowrap scrollbar-none pr-4 border-r border-border/10">
            <div className="flex items-center text-sm font-medium h-full">
              {level === "search" ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Search className="h-4 w-4" />
                  高级搜索
                </span>
              ) : (
                <Breadcrumb>
                  <BreadcrumbList className="flex-nowrap">
                    {breadcrumbs.map((crumb, i) => {
                      const isLast = i === breadcrumbs.length - 1;
                      return (
                        <React.Fragment key={i}>
                          <BreadcrumbItem className="whitespace-nowrap">
                            {isLast ? (
                              <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink asChild>
                                <button
                                  type="button"
                                  onClick={crumb.onClick}
                                  className="hover:text-foreground transition-colors"
                                >
                                  {crumb.label}
                                </button>
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                          {!isLast && <BreadcrumbSeparator />}
                        </React.Fragment>
                      );
                    })}
                  </BreadcrumbList>
                </Breadcrumb>
              )}
            </div>
          </div>

          {/* Right Actions Area - 1/3 Width */}
          <div className="w-1/3 h-full pl-4 flex items-center gap-2">
            {level === "search" ? (
              <div className="w-full flex justify-end">
                <Button variant="ghost" size="sm" className="gap-1" onClick={handleGoToRoot}>
                  <X className="h-4 w-4" />
                  关闭搜索
                </Button>
              </div>
            ) : (
              <>
                {/* Search + View */}
                <div className="flex-1 flex items-center gap-2 min-w-0">
                  {/* Search Bar - Flex to fill */}
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder={level === "buckets" ? "搜索存储桶..." : "搜索文件..."}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-8 pl-8 pr-8 w-full"
                    />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                      {searchTerm ? (
                        <button
                          type="button"
                          onClick={() => setSearchTerm("")}
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  setLevel("search");
                                  setSearchTerm("");
                                }}
                              >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>高级搜索</TooltipContent>
                          </Tooltip>
                      )}
                    </div>
                  </div>

                  {/* Offline Indicator */}
                  {(level === "buckets" ? bucketsIsFromCache : objectsIsFromCache) && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="default" className="h-8 gap-1 px-2 whitespace-nowrap shrink-0">
                             <WifiOff className="h-3.5 w-3.5" />
                             <span className="hidden xl:inline">离线缓存</span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          数据来自离线缓存 · 上次同步: {
                            new Date((level === "buckets" ? bucketsLastSync : objectsLastSync) || 0).toLocaleString()
                          }
                        </TooltipContent>
                      </Tooltip>
                  )}

                  {/* View Mode */}
                  <div className="flex items-center rounded-md border border-border/40 bg-background shrink-0">
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-r-none"
                      onClick={() => handleViewModeChange("list")}
                      title="平铺列表"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "tree" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-none border-x border-border/20"
                      onClick={() => handleViewModeChange("tree")}
                      title="树形视图"
                    >
                      <FolderTree className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-l-none"
                      onClick={() => handleViewModeChange("grid")}
                      title="网格视图"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 shrink-0">
                  {level === "objects" && canCreateSymlink && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => setSymlinkDialogOpen(true)}
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      <span className="truncate">软链接</span>
                    </Button>
                  )}
                  {level === "objects" && (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      <span className="truncate">上传</span>
                    </Button>
                  )}
                  {selectedKeys.size > 0 && level === "objects" ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                          <span className="text-sm">已选 {selectedKeys.size} 项</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-48 p-1" align="end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-9"
                          onClick={() => {
                            const targets = objects.filter(o => selectedKeys.has(o.key) && !o.isDir);
                            if (targets.length === 0) {
                              toast.error("请选择至少一个文件");
                              return;
                            }
                            
                            if (isBridgeAvailable()) {
                              if (targets.length > 20 && !confirm(`确认下载 ${targets.length} 个文件?`)) return;
                              targets.forEach(async (target) => {
                                try {
                                  await handleDownload(target.key);
                                } catch (e) {
                                  console.error(`Failed to download ${target.key}:`, e);
                                }
                              });
                              toast.success(`开始下载 ${targets.length} 个文件`);
                            } else {
                              toast.error("Web 端暂不支持批量下载");
                            }
                          }}
                        >
                          <Download className="h-4 w-4" />
                          <span>下载</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-9"
                          onClick={() => {
                            toast.info("移动功能正在开发中");
                            // TODO: Implement move functionality
                            // Need to add a dialog to select target bucket/prefix
                          }}
                        >
                          <Move className="h-4 w-4" />
                          <span>移动</span>
                        </Button>
                        <div className="h-px bg-border my-1" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2 h-9 text-destructive hover:text-destructive"
                          onClick={() => {
                            const count = selectedKeys.size;
                            if (count === 0) return;
                            
                            const confirmed = confirm(
                              `确认要删除选中的 ${count} 个项目吗？\n\n此操作不可撤销！`
                            );
                            
                            if (confirmed) {
                              void objectsStore.deleteSelected();
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>删除</span>
                        </Button>
                      </PopoverContent>
                    </Popover>
                  ) : null}
                  {level === "buckets" && (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1 h-8"
                      onClick={() => setCreateBucketOpen(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span className="truncate">新建桶</span>
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {level === "search" ? (
          <div className="flex-1 overflow-y-auto p-4">
            <SearchPanel buckets={buckets.map((b) => b.name)} />
          </div>
        ) : (
          <>
            {/* Error */}
            {error && <p className="px-4 pt-2 text-sm text-destructive">{error}</p>}

            {/* Content with context menu on background */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  className="flex-1 overflow-auto"
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

                  {renderContent()}

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
          </>
        )}
      </Card>

      <FilePreviewModal
        open={previewOpen}
        onOpenChange={(openState) => {
          setPreviewOpen(openState);
          if (!openState) {
            setPreviewObject(null);
          }
        }}
        accountId={accountId}
        bucket={currentBucket ?? undefined}
        object={previewObject ?? undefined}
      />

      {/* Create Bucket Dialog */}
      <CreateBucketDialog
        open={createBucketOpen}
        onOpenChange={setCreateBucketOpen}
        accountId={accountId}
        defaultRegion={activeAccount?.region || "us-east-1"}
        isOSSProvider={isOSSProvider}
        isCOSProvider={isCOSProvider}
        onError={(msg) => {
          setErrorMessage(msg);
          setErrorDialogOpen(true);
        }}
      />

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

      {/* Symlink Dialog */}
      <SymlinkDialog
        open={symlinkDialogOpen}
        onOpenChange={setSymlinkDialogOpen}
        accountId={accountId}
        bucket={currentBucket ?? undefined}
        prefix={prefix}
        onError={(msg) => {
          setErrorMessage(msg);
        }}
      />

      {/* Error Dialog */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>操作失败</AlertDialogTitle>
            <AlertDialogDescription>{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>确定</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    </TooltipProvider>
  );
}
