import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListBuckets, ListObjects } from "@wailsjs/go/app/App";
import type { buckets } from "@wailsjs/go/models";
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
  const [buckets, setBuckets] = useState<buckets.BucketInfo[]>([]);
  const [selectedBucket, setSelectedBucket] = useState(initialBucket);
  const [currentPrefix, setCurrentPrefix] = useState(initialPrefix);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load buckets on mount
  useEffect(() => {
    const loadBuckets = async () => {
      try {
        const list = await ListBuckets(accountId);
        setBuckets(list);
        if (!selectedBucket && list.length > 0) {
          setSelectedBucket(list[0].name);
        }
      } catch (e) {
        console.error("Failed to list buckets", e);
      }
    };
    void loadBuckets();
  }, [accountId, selectedBucket]);

  // Load folders when bucket or prefix changes
  useEffect(() => {
    const loadFolders = async () => {
      if (!selectedBucket) return;
      setLoading(true);
      try {
        // We use delimiter "/" to get folders (common prefixes)
        const result = await ListObjects(accountId, {
          bucket: selectedBucket,
          prefix: currentPrefix,
          delimiter: "/",
          limit: 1000,
          marker: "",
        });

        // Backend should return pseudo-folders as objects with IsDir=true
        // or we infer from keys ending in "/"
        const folderItems: FolderItem[] = result.objects
          .filter((o) => o.isDir)
          .map((o) => ({
            name: o.key.slice(currentPrefix.length).replace(/\/$/, ""),
            path: o.key,
          }));

        setFolders(folderItems);
      } catch (e) {
        console.error("Failed to list folders", e);
      } finally {
        setLoading(false);
      }
    };
    void loadFolders();
  }, [accountId, selectedBucket, currentPrefix]);

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
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : folders.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("objects.folderPicker.empty")}
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map((folder) => (
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
