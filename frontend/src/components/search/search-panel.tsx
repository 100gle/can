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
import { showError } from "@/lib/toast";
import { formatBytes } from "@/lib/utils";
import { searchStore, useSearchStore } from "@/state/search";
import { useForm, useStore } from "@tanstack/react-form";
import { TFunction } from "i18next";
import { Bookmark, BookmarkPlus, DownloadCloud, Loader2, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

const formatDateInputValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

type SearchPanelProps = {
  buckets: string[];
};

const createSearchFormSchema = (t: TFunction) =>
  z
    .object({
      accountId: z.string(),
      bucket: z.string(),
      prefix: z.string(),
      searchText: z.string(),
      sortBy: z.enum(["name", "size", "time", "score"]),
      sortOrder: z.enum(["asc", "desc"]),
      minSize: z.number().min(0, t("searchPanel.validation.minSize")),
      maxSize: z.number().min(0, t("searchPanel.validation.maxSize")),
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
          message: t("searchPanel.validation.maxLessThanMin"),
        });
      }
      if (data.startTime && data.endTime) {
        if (new Date(data.startTime) > new Date(data.endTime)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["endTime"],
            message: t("searchPanel.validation.endBeforeStart"),
          });
        }
      }
    });

export const SearchPanel = ({ buckets }: SearchPanelProps) => {
  const { t } = useTranslation();
  const searchFormSchema = useMemo(() => createSearchFormSchema(t), [t]);
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
      showError(t("searchPanel.save.error"));
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
            <Label>{t("searchPanel.form.scope.label")}</Label>
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
                      <SelectValue placeholder={t("searchPanel.form.scope.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("searchPanel.form.scope.all")}</SelectItem>
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
            <Label htmlFor="prefix">{t("searchPanel.form.prefix.label")}</Label>
            <form.Field name="prefix">
              {(field) => (
                <Input
                  id="prefix"
                  placeholder={t("searchPanel.form.prefix.placeholder")}
                  value={field.state.value ?? ""}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                />
              )}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="keyword">{t("searchPanel.form.keyword.label")}</Label>
            <form.Field name="searchText">
              {(field) => (
                <Input
                  id="keyword"
                  placeholder={t("searchPanel.form.keyword.placeholder")}
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
            <Label htmlFor="min-size">{t("searchPanel.form.minSize.label", { unit: "MB" })}</Label>
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
                    {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                  </div>
                );
              }}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-size">{t("searchPanel.form.maxSize.label", { unit: "MB" })}</Label>
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
                    {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                  </div>
                );
              }}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-types">{t("searchPanel.form.fileTypes.label")}</Label>
            <form.Field name="fileTypes">
              {(field) => (
                <Input
                  id="file-types"
                  placeholder={t("searchPanel.form.fileTypes.placeholder")}
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
            <Label htmlFor="start-date">{t("searchPanel.form.startDate.label")}</Label>
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
            <Label htmlFor="end-date">{t("searchPanel.form.endDate.label")}</Label>
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
                    {showError && <p className="text-xs text-destructive">{errorMessage}</p>}
                  </div>
                );
              }}
            </form.Field>
          </div>
          <div className="space-y-2">
            <Label>{t("searchPanel.form.sort.label")}</Label>
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
                    <SelectItem value="name">{t("searchPanel.form.sort.options.name")}</SelectItem>
                    <SelectItem value="size">{t("searchPanel.form.sort.options.size")}</SelectItem>
                    <SelectItem value="time">{t("searchPanel.form.sort.options.time")}</SelectItem>
                    <SelectItem value="score">
                      {t("searchPanel.form.sort.options.score")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </form.Field>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {t("searchPanel.actions.search")}
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
              {t("searchPanel.actions.exportCsv")}
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
              {t("searchPanel.actions.exportJson")}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Popover open={saveOpen} onOpenChange={setSaveOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <BookmarkPlus className="h-4 w-4" />
                  {t("searchPanel.save.trigger")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">{t("searchPanel.save.title")}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t("searchPanel.save.description")}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="save-name">{t("searchPanel.save.nameLabel")}</Label>
                    <Input
                      id="save-name"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder={t("searchPanel.save.namePlaceholder")}
                    />
                  </div>
                  <Button onClick={handleSaveQuery}>{t("searchPanel.save.confirm")}</Button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  {t("searchPanel.saved.trigger")}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[250px] p-0">
                <div className="p-2 text-xs font-semibold text-muted-foreground">
                  {t("searchPanel.saved.title")}
                </div>
                <div className="h-px bg-border" />
                <div className="max-h-[300px] overflow-y-auto p-1">
                  {savedQueries.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      {t("searchPanel.saved.empty")}
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
            <p className="text-sm font-semibold">
              {t("searchPanel.results.summary", { count: total })}
            </p>
            <p className="text-xs text-muted-foreground">{t("searchPanel.results.tip")}</p>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("searchPanel.results.loading")}
            </div>
          )}
        </div>
        <div className="mt-4">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("searchPanel.results.empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("searchPanel.table.object")}</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>{t("searchPanel.table.size")}</TableHead>
                  <TableHead>{t("searchPanel.table.updated")}</TableHead>
                  <TableHead>{t("searchPanel.table.storageClass")}</TableHead>
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
        {hasMore && (
          <div className="mt-4 text-right">
            <Button variant="outline" onClick={() => searchStore.loadMore()} disabled={loadingMore}>
              {loadingMore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("searchPanel.results.loadMore")
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
