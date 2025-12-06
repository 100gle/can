import {
  ArrowLeft,
  DownloadCloud,
  FolderPlus,
  Link2,
  Loader2,
  RefreshCcw,
  Search,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { PresignedURLDialog } from "@/components/transfer/presigned-url-dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveFileDialog } from "@/lib/bridge";
import { cn } from "@/lib/utils";
import { objectsStore, useObjectsStore } from "@/state/objects";
import { transfersStore } from "@/state/transfers";
import { GetPresignedDownloadURL } from "@wailsjs/go/main/App";

export type ObjectBrowserProps = {
  accountId?: string;
  bucket?: string;
  onOpenSearch?: () => void;
  className?: string;
};

export function ObjectBrowser({ accountId, bucket, onOpenSearch, className }: ObjectBrowserProps) {
  const { objects, loading, loadingMore, uploading, error, prefix, truncated, pendingKeys } =
    useObjectsStore((state) => state);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: "download" | "upload";
    key?: string;
  }>({
    open: false,
    mode: "download",
  });
  const [copyingKey, setCopyingKey] = useState<string>();
  const [pendingDeleteKey, setPendingDeleteKey] = useState<string | null>(null);

  useEffect(() => {
    void objectsStore.setContext(accountId, bucket);
  }, [accountId, bucket]);

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "true");
    }
  }, []);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(prefix), [prefix]);
  const canUpload = Boolean(accountId && bucket);

  const handleEnterDir = (key: string) => {
    void objectsStore.enterPrefix(key.endsWith("/") ? key : `${key}/`);
  };

  const handleGoUp = () => {
    void objectsStore.goUp();
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files?.length) return;
    if (!accountId || !bucket) {
      window.alert?.("请选择账户与 Bucket 后再上传文件");
      return;
    }
    await transfersStore.uploadFiles(Array.from(files), { accountId, bucket, prefix });
    event.target.value = "";
  };

  const handleFoldersSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files?.length) return;
    if (!accountId || !bucket) return;
    await transfersStore.uploadFiles(Array.from(files), { accountId, bucket, prefix });
    event.target.value = "";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!bucket || !accountId) return;
    setDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!bucket || !accountId) {
      setDragActive(false);
      return;
    }
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) {
      void transfersStore.uploadFiles(files, { accountId, bucket, prefix });
    }
    setDragActive(false);
  };

  const handleCopyLink = async (objectKey: string) => {
    if (!accountId || !bucket) return;
    setCopyingKey(objectKey);
    try {
      const url = await GetPresignedDownloadURL(accountId, bucket, objectKey, 60);
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error(error);
      window.alert?.("复制失败，请稍后重试");
    } finally {
      setCopyingKey(undefined);
    }
  };

  const openPresignDialog = (mode: "download" | "upload", key: string) => {
    setDialogState({ open: true, mode, key });
  };

  const closeDialog = () => setDialogState((current) => ({ ...current, open: false }));

  const handleDownload = async (objectKey: string) => {
    const defaultName = objectKey.split("/").filter(Boolean).pop() || "object";
    const savePath = await saveFileDialog({ Title: "保存对象", DefaultFilename: defaultName });
    if (!savePath) return;
    try {
      await objectsStore.downloadToPath(objectKey, savePath);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = (objectKey: string) => {
    setPendingDeleteKey(objectKey);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteKey) return;
    try {
      await objectsStore.deleteObject(pendingDeleteKey);
    } catch (error) {
      console.error(error);
    } finally {
      setPendingDeleteKey(null);
    }
  };

  return (
    <>
      <Card className={cn("flex h-full flex-col", className)}>
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
          onChange={handleFoldersSelected}
        />
        <div className="flex flex-col gap-3 border-b border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">对象浏览器</p>
              <h3 className="text-lg font-semibold">
                {bucket ? `${bucket} · Objects` : "等待 Bucket"}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => objectsStore.refresh()}
                disabled={!bucket || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                刷新
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => onOpenSearch?.()}
                disabled={!accountId}
              >
                <Search className="h-4 w-4" />
                搜索
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canUpload || uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                上传文件
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => folderInputRef.current?.click()}
                disabled={!canUpload || uploading}
              >
                <FolderPlus className="h-4 w-4" />
                上传文件夹
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  return (
                    <BreadcrumbItem key={crumb.path} className="flex items-center">
                      {isLast ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => {
                              objectsStore.enterPrefix(crumb.path);
                            }}
                          >
                            {crumb.label}
                          </button>
                        </BreadcrumbLink>
                      )}
                      {!isLast ? <BreadcrumbSeparator /> : null}
                    </BreadcrumbItem>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
            {prefix ? (
              <Button variant="ghost" size="sm" className="gap-1" onClick={handleGoUp}>
                <ArrowLeft className="h-3 w-3" />
                返回上级
              </Button>
            ) : null}
          </div>
        </div>
        {error ? <p className="px-4 pt-2 text-sm text-destructive">{error}</p> : null}
        <div
          className="relative flex-1 overflow-x-auto p-4"
          onDragEnter={handleDragOver}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragActive ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-background/80 text-center text-primary">
              <UploadCloud className="h-8 w-8" />
              <p className="mt-2 text-sm font-semibold">释放以上传文件</p>
              <p className="text-xs text-muted-foreground">支持多文件与目录拖拽</p>
            </div>
          ) : null}
          {!bucket ? (
            <p className="text-sm text-muted-foreground">请选择 Bucket 以查看对象。</p>
          ) : loading && objects.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在加载对象
            </div>
          ) : objects.length === 0 ? (
            <p className="text-sm text-muted-foreground">当前路径下暂无对象。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3 min-w-40">名称</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>最近更新</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {objects.map((object) => (
                  <TableRow key={object.key}>
                    <TableCell>
                      {object.isDir ? (
                        <button
                          className="flex items-center gap-2 font-medium text-primary hover:underline"
                          onClick={() => handleEnterDir(object.key)}
                        >
                          📁 {deriveLabel(object, prefix)}
                        </button>
                      ) : (
                        <span className="font-medium">{deriveLabel(object, prefix)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {object.isDir ? "-" : formatSize(object.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(object.lastModified)}
                    </TableCell>
                    <TableCell className="text-right">
                      {object.isDir ? null : (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleDownload(object.key)}
                            disabled={pendingKeys[object.key] === "downloading"}
                          >
                            {pendingKeys[object.key] === "downloading" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <DownloadCloud className="h-4 w-4" />
                            )}
                            下载
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => handleCopyLink(object.key)}
                            disabled={!canUpload || copyingKey === object.key}
                          >
                            {copyingKey === object.key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Link2 className="h-4 w-4" />
                            )}
                            复制链接
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={() => openPresignDialog("download", object.key)}
                            disabled={!canUpload}
                          >
                            分享
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive"
                            onClick={() => handleDelete(object.key)}
                            disabled={pendingKeys[object.key] === "deleting"}
                          >
                            {pendingKeys[object.key] === "deleting" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "删除"
                            )}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {truncated ? (
          <div className="border-t border-border/40 p-4 text-right">
            <Button
              variant="outline"
              size="sm"
              onClick={() => objectsStore.loadMore()}
              disabled={loadingMore}
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "加载更多"}
            </Button>
          </div>
        ) : null}
        <PresignedURLDialog
          open={dialogState.open}
          mode={dialogState.mode}
          accountId={accountId}
          bucket={bucket}
          objectKey={dialogState.key}
          onClose={closeDialog}
        />
      </Card>

      <AlertDialog
        open={!!pendingDeleteKey}
        onOpenChange={(open) => !open && setPendingDeleteKey(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除对象？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除对象"{pendingDeleteKey}"，该操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const buildBreadcrumbs = (prefix: string) => {
  const result: { label: string; path: string }[] = [{ label: "根目录", path: "" }];
  if (!prefix) return result;
  const segments = prefix.replace(/\/$/, "").split("/").filter(Boolean);
  let cursor = "";
  segments.forEach((segment) => {
    cursor += `${segment}/`;
    result.push({ label: segment, path: cursor });
  });
  return result;
};

const deriveLabel = (object: { key: string; isDir: boolean }, prefix: string) => {
  const base =
    prefix && object.key.startsWith(prefix) ? object.key.slice(prefix.length) : object.key;
  if (object.isDir) {
    return base.replace(/\/$/, "");
  }
  const parts = base.split("/").filter(Boolean);
  return parts.join("/");
};

const formatSize = (size?: number) => {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const formatDate = (value: any) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
};
