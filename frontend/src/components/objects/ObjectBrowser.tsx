import { useEffect, useMemo } from "react";
import { ArrowLeft, DownloadCloud, Loader2, RefreshCcw, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { openFileDialog, saveFileDialog } from "@/lib/bridge";
import { cn } from "@/lib/utils";
import { objectsStore, useObjectsStore } from "@/state/objects";

export type ObjectBrowserProps = {
  accountId?: string;
  bucket?: string;
  className?: string;
};

export function ObjectBrowser({ accountId, bucket, className }: ObjectBrowserProps) {
  const { objects, loading, loadingMore, uploading, error, prefix, truncated, pendingKeys } =
    useObjectsStore((state) => state);

  useEffect(() => {
    void objectsStore.setContext(accountId, bucket);
  }, [accountId, bucket]);

  const breadcrumbs = useMemo(() => buildBreadcrumbs(prefix), [prefix]);

  const handleEnterDir = (key: string) => {
    void objectsStore.enterPrefix(key.endsWith("/") ? key : `${key}/`);
  };

  const handleGoUp = () => {
    void objectsStore.goUp();
  };

  const handleUpload = async () => {
    const filePath = await openFileDialog({ Title: "选择上传文件" });
    if (!filePath) return;
    const fileName = filePath.split(/[/\\]/).pop() ?? `object-${Date.now()}`;
    const base = prefix ? (prefix.endsWith("/") ? prefix : `${prefix}/`) : "";
    const defaultKey = `${base}${fileName}`;
    const key = window.prompt?.("确认对象 Key", defaultKey) || defaultKey;
    if (!key) return;
    try {
      await objectsStore.uploadFromPath(filePath, key);
    } catch (error) {
      console.error(error);
    }
  };

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

  const handleDelete = async (objectKey: string) => {
    const confirmed = window.confirm?.(`确定删除对象 ${objectKey} 吗？`);
    if (!confirmed) return;
    try {
      await objectsStore.deleteObject(objectKey);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Card className={cn("flex h-full flex-col", className)}>
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
              variant="secondary"
              size="sm"
              className="gap-1"
              onClick={handleUpload}
              disabled={!bucket || uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              上传
            </Button>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {breadcrumbs.map((crumb, index) => (
            <button
              key={crumb.path}
              className={cn(
                "text-left",
                index === breadcrumbs.length - 1
                  ? "font-semibold text-foreground"
                  : "hover:underline",
              )}
              disabled={index === breadcrumbs.length - 1}
              onClick={() => {
                if (index === breadcrumbs.length - 1) return;
                objectsStore.enterPrefix(crumb.path);
              }}
            >
              {crumb.label}
            </button>
          ))}
          {prefix ? (
            <Button variant="ghost" size="sm" className="gap-1" onClick={handleGoUp}>
              <ArrowLeft className="h-3 w-3" />
              返回
            </Button>
          ) : null}
        </nav>
      </div>
      {error ? <p className="px-4 pt-2 text-sm text-destructive">{error}</p> : null}
      <div className="flex-1 overflow-x-auto p-4">
        {!bucket ? (
          <p className="text-sm text-muted-foreground">请选择 Bucket 以查看对象。</p>
        ) : loading && objects.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在加载对象
          </div>
        ) : objects.length === 0 ? (
          <p className="text-sm text-muted-foreground">当前路径下暂无对象。</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-2 text-left">名称</th>
                <th className="py-2 text-left">大小</th>
                <th className="py-2 text-left">最近更新</th>
                <th className="py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {objects.map((object) => (
                <tr key={object.key} className="border-b border-border/40 text-sm">
                  <td className="py-2">
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
                  </td>
                  <td className="py-2 text-muted-foreground">
                    {object.isDir ? "-" : formatSize(object.size)}
                  </td>
                  <td className="py-2 text-muted-foreground">{formatDate(object.lastModified)}</td>
                  <td className="py-2 text-right">
                    {object.isDir ? null : (
                      <div className="flex items-center justify-end gap-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </Card>
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
