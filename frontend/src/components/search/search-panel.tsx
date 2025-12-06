import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { getFieldErrorMessage } from "@/lib/forms";
import { formatBytes } from "@/lib/utils";
import { searchStore, useSearchStore } from "@/state/search";
import { useForm, useStore } from "@tanstack/react-form";
import { Bookmark, BookmarkPlus, DownloadCloud, Loader2, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

type SearchPanelProps = {
  buckets: string[];
};

const formatDateInputValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const searchFormSchema = z
  .object({
    accountId: z.string(),
    bucket: z.string(),
    prefix: z.string(),
    searchText: z.string(),
    sortBy: z.enum(["name", "size", "time", "score"]),
    sortOrder: z.enum(["asc", "desc"]),
    minSize: z.number().min(0, "最小大小需大于等于 0"),
    maxSize: z.number().min(0, "最大大小需大于等于 0"),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    fileTypes: z.array(z.string()),
    tags: z.record(z.string(), z.string()),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  })
  .superRefine((data, ctx) => {
    if (data.maxSize > 0 && data.maxSize < data.minSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxSize"],
        message: "最大大小需大于最小大小",
      });
    }
    if (data.startTime && data.endTime) {
      if (new Date(data.startTime) > new Date(data.endTime)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "结束日期需不早于起始日期",
        });
      }
    }
  });

export const SearchPanel = ({ buckets }: SearchPanelProps) => {
  const query = useSearchStore((state) => state.query);
  const results = useSearchStore((state) => state.results);
  const loading = useSearchStore((state) => state.loading);
  const loadingMore = useSearchStore((state) => state.loadingMore);
  const exporting = useSearchStore((state) => state.exporting);
  const hasMore = useSearchStore((state) => state.hasMore);
  const error = useSearchStore((state) => state.error);
  const total = useSearchStore((state) => state.total);
  const savedQueries = useSearchStore((state) => state.savedQueries);

  const [saveName, setSaveName] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    void searchStore.loadSavedQueries();
  }, []);

  const form = useForm({
    defaultValues: query,
    validators: {
      onSubmit: ({ value }) => {
        searchFormSchema.parse(value);
      },
    },
    onSubmit: async ({ value }) => {
      await searchStore.search(value);
    },
  });

  const formValues = useStore(form.store, (state) => state.values);
  const formSubmitted = useStore(form.store, (state) => state.isSubmitted);

  useEffect(() => {
    form.reset(query);
  }, [query, form]);

  const bucketOptions = useMemo(() => {
    const uniques = new Set(buckets);
    const activeBucket = formValues.bucket || query.bucket;
    if (activeBucket && !uniques.has(activeBucket)) {
      uniques.add(activeBucket);
    }
    return Array.from(uniques);
  }, [buckets, formValues.bucket, query.bucket]);

  const handleExport = (format: "csv" | "json") => {
    void searchStore.exportResults(format);
  };

  const handleSaveQuery = async () => {
    if (!saveName.trim()) return;
    try {
      // Sync form values to store before saving
      searchStore.setQuery(formValues);
      await searchStore.saveQuery(saveName);
      setSaveOpen(false);
      setSaveName("");
    } catch {
      window.alert?.("保存失败");
    }
  };

  return (
    <div className="space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-4 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>搜索范围</Label>
            <form.Field name="bucket">
              {(field) => {
                const value = field.state.value || "all";
                return (
                  <Select
                    value={value}
                    onValueChange={(nextValue) => {
                      field.handleChange(nextValue === "all" ? "" : nextValue);
                      field.handleBlur();
                    }}
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
                );
              }}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prefix">前缀</Label>
            <form.Field name="prefix">
              {(field) => (
                <Input
                  id="prefix"
                  placeholder="logs/2025/"
                  value={field.state.value ?? ""}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyword">关键字</Label>
            <form.Field name="searchText">
              {(field) => (
                <Input
                  id="keyword"
                  placeholder="报告、合同等"
                  value={field.state.value ?? ""}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="min-size">最小大小 (MB)</Label>
            <form.Field name="minSize">
              {(field) => {
                const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                const showError = Boolean(
                  errorMessage && (field.state.meta.isTouched || formSubmitted),
                );
                const displayValue =
                  field.state.value && field.state.value > 0
                    ? String(field.state.value / (1024 * 1024))
                    : "";
                return (
                  <div className="space-y-1">
                    <Input
                      id="min-size"
                      type="number"
                      min={0}
                      value={displayValue}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        field.handleChange(value ? value * 1024 * 1024 : 0);
                      }}
                      onBlur={field.handleBlur}
                      aria-invalid={showError}
                    />
                    {showError ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
                  </div>
                );
              }}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-size">最大大小 (MB)</Label>
            <form.Field name="maxSize">
              {(field) => {
                const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                const showError = Boolean(
                  errorMessage && (field.state.meta.isTouched || formSubmitted),
                );
                const displayValue =
                  field.state.value && field.state.value > 0
                    ? String(field.state.value / (1024 * 1024))
                    : "";
                return (
                  <div className="space-y-1">
                    <Input
                      id="max-size"
                      type="number"
                      min={0}
                      value={displayValue}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        field.handleChange(value ? value * 1024 * 1024 : 0);
                      }}
                      onBlur={field.handleBlur}
                      aria-invalid={showError}
                    />
                    {showError ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
                  </div>
                );
              }}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-types">文件类型 (.扩展)</Label>
            <form.Field name="fileTypes">
              {(field) => (
                <Input
                  id="file-types"
                  placeholder=".pdf,.png"
                  value={field.state.value?.join(", ") ?? ""}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value
                        .split(",")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="start-date">起始日期</Label>
            <form.Field name="startTime">
              {(field) => (
                <Input
                  id="start-date"
                  type="date"
                  value={formatDateInputValue(field.state.value)}
                  onChange={(event) =>
                    field.handleChange(
                      event.target.value ? new Date(event.target.value).toISOString() : undefined,
                    )
                  }
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="end-date">结束日期</Label>
            <form.Field name="endTime">
              {(field) => {
                const errorMessage = getFieldErrorMessage(field.state.meta.errors);
                const showError = Boolean(
                  errorMessage && (field.state.meta.isTouched || formSubmitted),
                );
                return (
                  <div className="space-y-1">
                    <Input
                      id="end-date"
                      type="date"
                      value={formatDateInputValue(field.state.value)}
                      onChange={(event) =>
                        field.handleChange(
                          event.target.value
                            ? new Date(event.target.value).toISOString()
                            : undefined,
                        )
                      }
                      onBlur={field.handleBlur}
                      aria-invalid={showError}
                    />
                    {showError ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
                  </div>
                );
              }}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label>排序方式</Label>
            <form.Field name="sortBy">
              {(field) => (
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    field.handleChange(value);
                    field.handleBlur();
                  }}
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
              )}
            </form.Field>
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                <DownloadCloud className="h-4 w-4" />
              )}
              导出 JSON
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Popover open={saveOpen} onOpenChange={setSaveOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <BookmarkPlus className="h-4 w-4" />
                  保存搜索
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">保存当前搜索条件</h4>
                    <p className="text-sm text-muted-foreground">
                      方便下次快速应用相同的过滤规则。
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="save-name">名称</Label>
                    <Input
                      id="save-name"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder="例如：大于100MB的PDF"
                    />
                  </div>
                  <Button onClick={handleSaveQuery}>确认保存</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  已保存
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[250px] p-0">
                <div className="p-2 text-xs font-semibold text-muted-foreground">我的搜索预设</div>
                <div className="h-px bg-border" />
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {savedQueries.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      暂无保存的搜索
                    </div>
                  ) : (
                    savedQueries.map((item) => (
                      <div
                        key={item.id}
                        className="flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => searchStore.applySavedQuery(item)}
                      >
                        <span className="truncate">{item.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            void searchStore.deleteSavedQuery(item.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
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
