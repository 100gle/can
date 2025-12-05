import { FormEvent, useEffect, useMemo, useState } from "react";
import { DownloadCloud, Loader2, Search, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const bucketValue = draft.bucket || "all";

  return (
    <div className="space-y-5">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>搜索范围</Label>
            <Select
              value={bucketValue}
              onValueChange={(value) =>
                setDraft((prev) => ({ ...prev, bucket: value === "all" ? "" : value }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="全局" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全局</SelectItem>
                {bucketOptions.map((bucket) => (
                  <SelectItem key={bucket} value={bucket}>
                    {bucket}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prefix">前缀</Label>
            <Input
              id="prefix"
              placeholder="logs/2025/"
              value={draft.prefix || ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, prefix: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyword">关键字</Label>
            <Input
              id="keyword"
              placeholder="报告、合同等"
              value={draft.searchText || ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, searchText: event.target.value }))
              }
            />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="min-size">最小大小 (MB)</Label>
            <Input
              id="min-size"
              type="number"
              min={0}
              value={draft.minSize ? draft.minSize / (1024 * 1024) : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDraft((prev) => ({ ...prev, minSize: value ? value * 1024 * 1024 : 0 }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-size">最大大小 (MB)</Label>
            <Input
              id="max-size"
              type="number"
              min={0}
              value={draft.maxSize ? draft.maxSize / (1024 * 1024) : ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                setDraft((prev) => ({ ...prev, maxSize: value ? value * 1024 * 1024 : 0 }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-types">文件类型 (.扩展)</Label>
            <Input
              id="file-types"
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
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="start-date">起始日期</Label>
            <Input
              id="start-date"
              type="date"
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">结束日期</Label>
            <Input
              id="end-date"
              type="date"
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
          </div>
          <div className="space-y-2">
            <Label>排序方式</Label>
            <Select
              value={draft.sortBy}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, sortBy: value }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">名称</SelectItem>
                <SelectItem value="size">大小</SelectItem>
                <SelectItem value="time">时间</SelectItem>
                <SelectItem value="score">匹配度</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        <div className="mt-4">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚无可显示的对象，请调整搜索条件。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>对象</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>大小</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead>存储类型</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((item) => (
                  <TableRow key={`${item.bucket}/${item.key}`}>
                    <TableCell className="font-medium">{item.key}</TableCell>
                    <TableCell className="text-muted-foreground">{item.bucket}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatBytes(item.size)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.lastModified
                        ? new Date(item.lastModified as any).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.storageClass || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
