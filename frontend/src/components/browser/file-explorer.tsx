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
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isBridgeAvailable, saveFileDialog } from "@/lib/bridge";
import { cn } from "@/lib/utils";
import { FilePreviewModal } from "@/components/objects/file-preview-modal";
import { bucketsStore, useBucketsStore } from "@/state/buckets";
import { useAccountsStore } from "@/state/accounts";
import { objectsStore, useObjectsStore, type ObjectModel } from "@/state/objects";
import { transfersStore } from "@/state/transfers";
import { CreateSymlink, GetPresignedDownloadURL } from "@wailsjs/go/app/App";
import {
  Download,
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  HardDrive,
  ChevronDown,
  LayoutGrid,
  Link2,
  Eye,
  List,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";

type FileExplorerProps = {
  accountId?: string;
  onOpenBucketSettings?: (bucket: string) => void;
  className?: string;
};

type BrowseLevel = "buckets" | "objects" | "search";

export function FileExplorer({ accountId, onOpenBucketSettings, className }: FileExplorerProps) {
  // Bucket state
  const {
    buckets,
    loading: bucketsLoading,
    creating,
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
  } = useObjectsStore((state) => state);

  const { accounts, capabilities } = useAccountsStore((state) => ({
    accounts: state.accounts,
    capabilities: state.capabilities,
  }));
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
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Dialog states
  const [createBucketOpen, setCreateBucketOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [newBucketRegion, setNewBucketRegion] = useState("us-east-1");
  const [bucketACL, setBucketACL] = useState("private");
  const [bucketStorageClass, setBucketStorageClass] = useState("standard");
  const [bucketCosMultiAz, setBucketCosMultiAz] = useState(false);
  const [advancedBucketOpen, setAdvancedBucketOpen] = useState(false);
  const [pendingDeleteBucket, setPendingDeleteBucket] = useState<string | null>(null);
  const [pendingDeleteObject, setPendingDeleteObject] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewObject, setPreviewObject] = useState<ObjectModel | null>(null);
  const [symlinkDialogOpen, setSymlinkDialogOpen] = useState(false);
  const [symlinkName, setSymlinkName] = useState("");
  const [symlinkTargetKey, setSymlinkTargetKey] = useState("");
  const [symlinkSaving, setSymlinkSaving] = useState(false);

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

  useEffect(() => {
    if (!createBucketOpen) {
      setAdvancedBucketOpen(false);
      setBucketACL("private");
      setBucketStorageClass(isOSSProvider ? "standard" : "");
      setBucketCosMultiAz(false);
      setNewBucketName("");
      setNewBucketRegion(activeAccount?.region || "us-east-1");
      return;
    }
    if (activeAccount?.region) {
      setNewBucketRegion(activeAccount.region);
    }
  }, [createBucketOpen, activeAccount?.region, isOSSProvider]);

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

  // Bucket actions
  const handleCreateBucket = async () => {
    if (!accountId) {
      setErrorMessage("请先选择账户");
      setErrorDialogOpen(true);
      return;
    }
    if (!newBucketName.trim()) {
      setErrorMessage("存储桶名称不能为空");
      setErrorDialogOpen(true);
      return;
    }
    try {
      const payload = {
        name: newBucketName.trim(),
        region: newBucketRegion.trim(),
        acl: bucketACL,
        storageClass: isOSSProvider ? bucketStorageClass : "",
        cosMultiAz: isCOSProvider ? bucketCosMultiAz : false,
      };
      await bucketsStore.createBucket(accountId, payload);
      setCreateBucketOpen(false);
      // Success - buckets list will auto-refresh via store
    } catch (e) {
      const message = e instanceof Error ? e.message : "创建存储桶失败";
      setErrorMessage(message);
      setErrorDialogOpen(true);
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

  const handleCreateSymlink = async () => {
    if (!accountId || !currentBucket) {
      setErrorMessage("请先选择账户和 Bucket 再创建软链接");
      setErrorDialogOpen(true);
      return;
    }
    const trimmedName = symlinkName.trim();
    const trimmedTarget = symlinkTargetKey.trim();
    if (!trimmedName || !trimmedTarget) {
      setErrorMessage("请输入软链接名称和目标 Key");
      setErrorDialogOpen(true);
      return;
    }
    const linkKey = `${prefix}${trimmedName}`.replace(/\/{2,}/g, "/");
    setSymlinkSaving(true);
    try {
      await CreateSymlink(accountId, currentBucket, linkKey, trimmedTarget);
      toast.success("软链接创建成功");
      setSymlinkDialogOpen(false);
      setSymlinkName("");
      setSymlinkTargetKey("");
      await objectsStore.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建软链接失败";
      setErrorMessage(message);
      setErrorDialogOpen(true);
    } finally {
      setSymlinkSaving(false);
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
  const renderItem = (item: any) => {
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
                  "relative flex items-center justify-center rounded-lg transition-transform group-hover:scale-110",
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
                {!isDir && item.isSymlink && (
                  <Link2 className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-background/90 p-0.5 text-primary shadow" />
                )}
              </div>
              <div className={cn("min-w-0", viewMode === "grid" ? "w-full" : "flex-1")}>
                <p className="truncate font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isDir ? "文件夹" : formatSize(item.size)}
                </p>
                {!isDir && item.isSymlink && (
                  <p className="truncate text-xs text-muted-foreground">
                    → {item.symlinkTarget || "未指定目标"}
                  </p>
                )}
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
                <ContextMenuItem onClick={() => handlePreview(item.key)}>
                  <Eye className="mr-2 h-4 w-4" />
                  预览
                </ContextMenuItem>
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
          <div className="w-1/3 h-full pl-4 grid grid-cols-4 gap-2 items-center">
            {level === "search" ? (
              <div className="col-span-4 flex justify-end">
                <Button variant="ghost" size="sm" className="gap-1" onClick={handleGoToRoot}>
                  <X className="h-4 w-4" />
                  关闭搜索
                </Button>
              </div>
            ) : (
              <>
                {/* Search + View - 3/4 */}
                <div className="col-span-3 flex items-center gap-2">
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
                        <TooltipProvider>
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
                        </TooltipProvider>
                      )}
                    </div>
                  </div>

                  {/* View Mode */}
                  <div className="flex items-center rounded-md border border-border/40 bg-background shrink-0">
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-r-none"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-8 w-8 rounded-l-none"
                      onClick={() => setViewMode("grid")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Refresh Button */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={handleRefresh}
                          disabled={loading}
                        >
                          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>刷新</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Actions - 1/4 */}
                <div className="col-span-1 flex justify-end gap-2">
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
                  {level === "buckets" && (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1 h-8 w-full"
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
                      {filteredItems.map((item) => renderItem(item))}
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
      <Dialog open={createBucketOpen} onOpenChange={setCreateBucketOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建存储桶 · Create Bucket</DialogTitle>
            <DialogDescription>
              命名遵循 S3 规则，Region/ACL 与提供商保持一致。Pick a region & policy that matches your
              provider.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label>名称 / Name</Label>
              <Input
                placeholder="my-team-bucket"
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                仅限小写字母、数字、`-`，长度 3-63。Lowercase letters, numbers, and hyphen only.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>区域 / Region</Label>
                <Input
                  placeholder="cn-hangzhou / us-east-1"
                  value={newBucketRegion}
                  onChange={(e) => setNewBucketRegion(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  留空将使用账户默认区域：{activeAccount?.region || "us-east-1"}。
                </p>
              </div>
              <div className="space-y-2">
                <Label>访问策略 / Access Control</Label>
                <Select value={bucketACL} onValueChange={setBucketACL}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择 ACL" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">私有 · Private</SelectItem>
                    <SelectItem value="public-read">公共读 · Public Read</SelectItem>
                    <SelectItem value="public-read-write">公共读写 · Public RW</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  默认私有。OSS/COS 会映射到各自的预设 ACL。
                </p>
              </div>
            </div>

            <Collapsible open={advancedBucketOpen} onOpenChange={setAdvancedBucketOpen}>
              <div className="flex items-center justify-between rounded-md border border-dashed border-border/60 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">高级配置 · Advanced Options</p>
                  <p className="text-xs text-muted-foreground">
                    供应商特有的参数（存储类型 / 多可用区等）。
                  </p>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    {advancedBucketOpen ? "收起" : "展开"}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        advancedBucketOpen ? "rotate-180" : "rotate-0",
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="space-y-4 pt-4">
                {isOSSProvider && (
                  <div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-3">
                    <Label>OSS 存储类型 / Storage Class</Label>
                    <Select value={bucketStorageClass} onValueChange={setBucketStorageClass}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">标准 · Standard</SelectItem>
                        <SelectItem value="ia">低频 · Infrequent Access</SelectItem>
                        <SelectItem value="archive">归档 · Archive</SelectItem>
                        <SelectItem value="cold">冷归档 · Cold Archive</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      影响新对象的默认存储层级，可在对象上传时再覆盖。
                    </p>
                  </div>
                )}

                {isCOSProvider && (
                  <div className="flex items-start justify-between rounded-lg border border-border/40 bg-muted/10 p-3">
                    <div>
                      <p className="text-sm font-medium">多可用区冗余 · MAZ</p>
                      <p className="text-xs text-muted-foreground">
                        在同一区域内复制到多个 AZ，提高容灾能力（可能带来费用变化）。Multi-AZ redundancy for
                        COS buckets.
                      </p>
                    </div>
                    <Switch checked={bucketCosMultiAz} onCheckedChange={setBucketCosMultiAz} />
                  </div>
                )}

                {!isOSSProvider && !isCOSProvider && (
                  <p className="text-xs text-muted-foreground">
                    当前供应商暂无额外创建参数。默认启用标准存储与私有访问。
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateBucketOpen(false)}>
              取消 / Cancel
            </Button>
            <Button onClick={handleCreateBucket} disabled={creating || !newBucketName.trim()}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建 / Create
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

      <Dialog open={symlinkDialogOpen} onOpenChange={setSymlinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建软链接</DialogTitle>
            <DialogDescription>软链接会映射到目标对象，可快速暴露常用路径。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>软链接名称</Label>
              <Input
                placeholder="latest/report.csv"
                value={symlinkName}
                onChange={(e) => setSymlinkName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                最终 Key: {(prefix || "/") + symlinkName}
              </p>
            </div>
            <div className="space-y-2">
              <Label>目标对象 Key</Label>
              <Input
                placeholder="archives/2025-02/report.csv"
                value={symlinkTargetKey}
                onChange={(e) => setSymlinkTargetKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">填写完整的对象 Key，区分大小写。</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSymlinkDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleCreateSymlink}
              disabled={
                symlinkSaving || !symlinkName.trim() || !symlinkTargetKey.trim() || !currentBucket
              }
            >
              {symlinkSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
