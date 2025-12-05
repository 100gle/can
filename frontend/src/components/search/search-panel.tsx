import { FormEvent, useEffect, useMemo, useState } from "react";
import { DownloadCloud, Loader2, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchStore, useSearchStore } from "@/state/search";
import { formatBytes } from "@/lib/utils";

type SearchPanelProps = {
  buckets: string[];
};

export const SearchPanel = ({ buckets }: SearchPanelProps) => {
  const query = useSearchStore((state) => state.query);
  const results = useSearchStore((state) => state.results);
  const loading = useSearchStore((state) => state.loading);
  const loadingMore = useSearchStore((state) => state.loadingMore);
  const exporting = useSearchStore((state) => state.exporting);
  const hasMore = useSearchStore((state) => state.hasMore);
  const error = useSearchStore((state) => state.error);
  const total = useSearchStore((state) => state.total);
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  const bucketOptions = useMemo(() => {
    const uniques = new Set(buckets);
    if (query.bucket && !uniques.has(query.bucket)) {
      uniques.add(query.bucket);
    }
    return Array.from(uniques);
  }, [buckets, query.bucket]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    searchStore.search(draft);
  };

  const handleExport = (format: "csv" | "json") => {
    void searchStore.exportResults(format);
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium">
            搜索范围
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              value={draft.bucket || ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, bucket: event.target.value }))}
            >
              <option value="">全局</option>
              {bucketOptions.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            前缀
            <input
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              placeholder="logs/2025/"
              value={draft.prefix || ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, prefix: event.target.value }))}
            />
          </label>
          <label className="text-sm font-medium">
            关键字
            <input
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              placeholder="报告、合同等"
              value={draft.searchText || ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, searchText: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium">
            最小大小 (MB)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              value={draft.minSize ? draft.minSize / (1024 * 1024) : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDraft((prev) => ({ ...prev, minSize: value ? value * 1024 * 1024 : 0 }));
              }}
            />
          </label>
          <label className="text-sm font-medium">
            最大大小 (MB)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              value={draft.maxSize ? draft.maxSize / (1024 * 1024) : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDraft((prev) => ({ ...prev, maxSize: value ? value * 1024 * 1024 : 0 }));
              }}
            />
          </label>
          <label className="text-sm font-medium">
            文件类型 (.扩展)
            <input
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              placeholder=".pdf,.png"
              value={draft.fileTypes?.join(", ") || ""}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  fileTypes: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                }))
              }
            />
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium">
            起始日期
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              value={draft.startTime ? new Date(draft.startTime).toISOString().slice(0, 10) : ""}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  startTime: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : undefined,
                }))
              }
            />
          </label>
          <label className="text-sm font-medium">
            结束日期
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              value={draft.endTime ? new Date(draft.endTime).toISOString().slice(0, 10) : ""}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  endTime: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : undefined,
                }))
              }
            />
          </label>
          <label className="text-sm font-medium">
            排序方式
            <select
              className="mt-1 w-full rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
              value={draft.sortBy}
              onChange={(event) => setDraft((prev) => ({ ...prev, sortBy: event.target.value }))}
            >
              <option value="name">名称</option>
              <option value="size">大小</option>
              <option value="time">时间</option>
              <option value="score">匹配度</option>
            </select>
          </label>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            执行搜索
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exporting || results.length === 0}
            onClick={() => handleExport("csv")}
            className="gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <DownloadCloud className="h-4 w-4" />
            )}
            导出 CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exporting || results.length === 0}
            onClick={() => handleExport("json")}
            className="gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            导出 JSON
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-border/50 bg-card/40 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">共 {total} 条结果</p>
            <p className="text-xs text-muted-foreground">最新搜索会覆盖上一轮结果</p>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载
            </div>
          ) : null}
        </div>
        <div className="mt-4 overflow-x-auto">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚无可显示的对象，请调整搜索条件。</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">对象</th>
                  <th className="py-2 text-left">Bucket</th>
                  <th className="py-2 text-left">大小</th>
                  <th className="py-2 text-left">更新时间</th>
                  <th className="py-2 text-left">存储类型</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={`${item.bucket}/${item.key}`} className="border-b border-border/30">
                    <td className="py-2 font-medium">{item.key}</td>
                    <td className="py-2 text-muted-foreground">{item.bucket}</td>
                    <td className="py-2 text-muted-foreground">{formatBytes(item.size)}</td>
                    <td className="py-2 text-muted-foreground">
                      {item.lastModified
                        ? new Date(item.lastModified as any).toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-2 text-muted-foreground">{item.storageClass || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {hasMore ? (
          <div className="mt-4 text-right">
            <Button variant="outline" onClick={() => searchStore.loadMore()} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "加载更多"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
