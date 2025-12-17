import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBuckets } from "@/hooks/useBuckets";
import { useQuery } from "@tanstack/react-query";
import { ListObjects } from "@wailsjs/go/app/App";
import type { storage } from "@wailsjs/go/models";
import { ChevronRight, Folder, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type FolderPickerProps = {
  accountId: string;
  initialBucket?: string;
  initialPrefix?: string;
  onSelect: (bucket: string, prefix: string) => void;
};

type FolderItem = {
  name: string;
  path: string;
};

export function FolderPicker({
  accountId,
  initialBucket,
  initialPrefix = "",
  onSelect,
}: FolderPickerProps) {
  const { t } = useTranslation();
  const { buckets, loading: bucketsLoading } = useBuckets(accountId);
  const [selectedBucket, setSelectedBucket] = useState(initialBucket);
  const [currentPrefix, setCurrentPrefix] = useState(initialPrefix);

  // Select first bucket when data arrives
  useEffect(() => {
    if (selectedBucket || !buckets.length) return;
    setSelectedBucket(initialBucket ?? buckets[0]?.name);
  }, [initialBucket, buckets, selectedBucket]);

  const foldersQuery = useQuery({
    queryKey: ["folder-picker", accountId, selectedBucket, currentPrefix],
    queryFn: async (): Promise<FolderItem[]> => {
      if (!accountId || !selectedBucket) return [];
      const result = await ListObjects(accountId, {
        bucket: selectedBucket,
        prefix: currentPrefix,
        delimiter: "/",
        limit: 1000,
        marker: "",
        region: "",
      });
      return result.objects
        .filter((o: storage.ObjectDescriptor) => o.isDir)
        .map((o: storage.ObjectDescriptor) => ({
          name: o.key.slice(currentPrefix.length).replace(/\/$/, ""),
          path: o.key,
        }));
    },
    enabled: Boolean(accountId && selectedBucket),
    staleTime: 10_000,
  });

  const handleEnterFolder = useCallback((path: string) => {
    setCurrentPrefix(path);
  }, []);

  const handleGoUp = useCallback(() => {
    if (!currentPrefix) return;
    const parts = currentPrefix.replace(/\/$/, "").split("/");
    parts.pop();
    const parent = parts.length > 0 ? parts.join("/") + "/" : "";
    setCurrentPrefix(parent);
  }, [currentPrefix]);

  const handleConfirm = useCallback(() => {
    if (selectedBucket) {
      onSelect(selectedBucket, currentPrefix);
    }
  }, [selectedBucket, currentPrefix, onSelect]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Select
          value={selectedBucket}
          onValueChange={(val) => {
            setSelectedBucket(val);
            setCurrentPrefix("");
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t("objects.folderPicker.bucket.placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {buckets.map((b) => (
              <SelectItem key={b.name} value={b.name}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border p-2">
        <div className="mb-2 flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1"
              onClick={() => setCurrentPrefix("")}
              disabled={!currentPrefix}
            >
              {t("objects.folderPicker.nav.root")}
            </Button>
            {currentPrefix
              .split("/")
              .filter(Boolean)
              .map((part, i) => (
                <div key={i} className="flex items-center">
                  <ChevronRight className="h-3 w-3" />
                  <span className="max-w-[100px] truncate">{part}</span>
                </div>
              ))}
          </div>
          {currentPrefix && (
            <Button variant="ghost" size="sm" className="h-6" onClick={handleGoUp}>
              {t("objects.folderPicker.nav.parent")}
            </Button>
          )}
        </div>

        <div className="h-[200px] overflow-y-auto rounded-md border p-1">
          {foldersQuery.isPending || bucketsLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (foldersQuery.data ?? []).length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("objects.folderPicker.empty")}
            </div>
          ) : (
            <div className="space-y-1">
              {(foldersQuery.data ?? []).map((folder) => (
                <Button
                  key={folder.path}
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm font-normal"
                  onClick={() => handleEnterFolder(folder.path)}
                >
                  <Folder className="h-4 w-4 text-blue-500" />
                  {folder.name}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <span>
          {t("objects.folderPicker.current", {
            path: selectedBucket
              ? `${selectedBucket}/${currentPrefix || t("objects.folderPicker.current.root")}`
              : "",
          })}
        </span>
      </div>

      <Button onClick={handleConfirm} disabled={!selectedBucket}>
        {t("objects.folderPicker.button.select")}
      </Button>
    </div>
  );
}
