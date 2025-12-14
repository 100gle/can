import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { objectsStore, useObjectsStore } from "@/state/objects";
import { ListObjects } from "@wailsjs/go/app/App";
import { Copy, FolderInput, Loader2, MoveRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FolderPicker } from "./folder-picker";

type MoveCopyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: "move" | "copy";
};

export function MoveCopyDialog({ open, onOpenChange, defaultMode = "copy" }: MoveCopyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {/* Conditional rendering: content only mounts when open, auto-resets state */}
        {open && (
          <MoveCopyDialogContent defaultMode={defaultMode} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

type MoveCopyDialogContentProps = {
  defaultMode: "move" | "copy";
  onClose: () => void;
};

function MoveCopyDialogContent({ defaultMode, onClose }: MoveCopyDialogContentProps) {
  const { t } = useTranslation();
  const { accountId, bucket: currentBucket, selectedKeys } = useObjectsStore((s) => s);

  // Initialize state directly from props - no useEffect needed
  const [mode, setMode] = useState<"move" | "copy">(defaultMode);
  const [targetBucket, setTargetBucket] = useState<string>(currentBucket || "");
  const [targetPrefix, setTargetPrefix] = useState<string>("");
  const [conflictStrategy, setConflictStrategy] = useState<"skip" | "overwrite" | "rename">(
    "rename",
  );
  const [pickingFolder, setPickingFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const normalizePrefix = (value: string) => {
    if (!value) return "";
    return value.endsWith("/") ? value : `${value}/`;
  };

  const fetchExistingKeys = async (account: string, bucketName: string, prefixValue: string) => {
    try {
      const result = await ListObjects(account, {
        bucket: bucketName,
        prefix: prefixValue,
        delimiter: "",
        limit: 1000,
        marker: "",
      });
      return new Set(result.objects.filter((object) => !object.isDir).map((object) => object.key));
    } catch (e) {
      console.warn("加载目标目录失败", e);
      return new Set<string>();
    }
  };

  const splitKey = (key: string) => {
    const slashIndex = key.lastIndexOf("/");
    const dir = slashIndex >= 0 ? key.slice(0, slashIndex + 1) : "";
    const base = slashIndex >= 0 ? key.slice(slashIndex + 1) : key;
    const dotIndex = base.lastIndexOf(".");
    if (dotIndex <= 0) {
      return { dir, name: base, ext: "" };
    }
    return {
      dir,
      name: base.slice(0, dotIndex),
      ext: base.slice(dotIndex),
    };
  };

  const resolveTargetKey = (
    sourceKey: string,
    prefixValue: string,
    strategy: "skip" | "overwrite" | "rename",
    existing: Set<string>,
    skipped: string[],
  ): string | null => {
    const pathSegments = sourceKey.split("/").filter(Boolean);
    const basename = pathSegments.pop() || sourceKey;
    const desiredKey = `${prefixValue}${basename}`;
    if (strategy === "overwrite") {
      return desiredKey;
    }
    if (strategy === "skip") {
      if (existing.has(desiredKey)) {
        skipped.push(sourceKey);
        return null;
      }
      return desiredKey;
    }
    const { dir, name, ext } = splitKey(desiredKey);
    let attempt = 1;
    let candidate = desiredKey;
    while (existing.has(candidate)) {
      candidate = `${dir}${name} (${attempt})${ext}`;
      attempt += 1;
      if (attempt > 999) {
        skipped.push(sourceKey);
        return null;
      }
    }
    return candidate;
  };

  const handleConfirm = async () => {
    if (!accountId || !currentBucket || !targetBucket) {
      setError(t("objects.moveCopy.error.noTarget"));
      return;
    }
    setLoading(true);
    setError(undefined);

    const keys = Array.from(selectedKeys);
    if (keys.length === 0) {
      onClose();
      return;
    }

    const normalizedPrefix = normalizePrefix(targetPrefix);
    const needsConflictResolution = conflictStrategy !== "overwrite";
    let existingKeys = new Set<string>();
    if (needsConflictResolution) {
      existingKeys = await fetchExistingKeys(accountId, targetBucket, normalizedPrefix);
    }
    const skipped: string[] = [];

    try {
      if (mode === "move") {
        const requests = [];
        for (const key of keys) {
          const targetKey = resolveTargetKey(
            key,
            normalizedPrefix,
            conflictStrategy,
            existingKeys,
            skipped,
          );
          if (!targetKey) continue;
          requests.push({
            sourceBucket: currentBucket,
            sourceKey: key,
            targetBucket: targetBucket,
            targetKey,
          });
          if (needsConflictResolution) {
            existingKeys.add(targetKey);
          }
        }
        if (requests.length === 0) {
          setError(t("objects.moveCopy.error.noTasks"));
          return;
        }
        await objectsStore.moveObjects(requests);
      } else {
        for (const key of keys) {
          const targetKey = resolveTargetKey(
            key,
            normalizedPrefix,
            conflictStrategy,
            existingKeys,
            skipped,
          );
          if (!targetKey) continue;
          await objectsStore.copyObject(key, targetBucket, targetKey);
          if (needsConflictResolution) {
            existingKeys.add(targetKey);
          }
        }
      }
      await objectsStore.refresh();
      if (skipped.length > 0) {
        setError(
          t("objects.moveCopy.error.skipped", {
            count: skipped.length,
            files: skipped.slice(0, 3).join(", "),
          }),
        );
        return;
      }
      objectsStore.clearSelection();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("objects.moveCopy.error.failed"));
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = selectedKeys.size;
  const targetPathDisplay = `${targetBucket}/${targetPrefix}`;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "copy" ? t("objects.moveCopy.title.copy") : t("objects.moveCopy.title.move")}
        </DialogTitle>
      </DialogHeader>

      {pickingFolder ? (
        <div className="py-2">
          <div className="mb-4 text-sm font-medium">{t("objects.moveCopy.picker.title")}</div>
          <FolderPicker
            accountId={accountId || ""}
            initialBucket={targetBucket}
            initialPrefix={targetPrefix}
            onSelect={(bucket, prefix) => {
              setTargetBucket(bucket);
              setTargetPrefix(prefix);
              setPickingFolder(false);
            }}
          />
          <div className="mt-4 flex justify-end">
            <Button variant="ghost" onClick={() => setPickingFolder(false)}>
              {t("common.back")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6 py-4">
          <Tabs
            value={mode}
            onValueChange={(v) => setMode(v as "move" | "copy")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="copy" className="gap-2">
                <Copy className="h-4 w-4" /> {t("common.copy")}
              </TabsTrigger>
              <TabsTrigger value="move" className="gap-2">
                <MoveRight className="h-4 w-4" /> {t("objects.moveCopy.tabs.move")}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>{t("objects.moveCopy.label.selected")}</Label>
                <div className="text-sm text-muted-foreground">
                  {t("objects.moveCopy.label.count", { count: selectedCount })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("objects.moveCopy.label.target")}</Label>
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <FolderInput className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1 truncate font-mono">{targetPathDisplay}</span>
                <Button variant="link" size="sm" onClick={() => setPickingFolder(true)}>
                  {t("objects.moveCopy.button.change")}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <Label>{t("objects.moveCopy.label.conflict")}</Label>
              <RadioGroup
                value={conflictStrategy}
                onValueChange={(v) => setConflictStrategy(v as any)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="skip" id="skip" />
                  <Label htmlFor="skip">{t("objects.moveCopy.conflict.skip")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="overwrite" id="overwrite" />
                  <Label htmlFor="overwrite">{t("objects.moveCopy.conflict.overwrite")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="rename" id="rename" />
                  <Label htmlFor="rename">{t("objects.moveCopy.conflict.rename")}</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">{t("objects.moveCopy.conflict.hint")}</p>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {!pickingFolder && (
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t("objects.details.button.cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.confirm")}
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
