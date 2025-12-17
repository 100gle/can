import { Button } from "@/components/ui/button";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useObjectMutations, type ObjectModel } from "@/hooks/useObjects";
import { showWarning } from "@/lib/toast";
import { objectsStore, useObjectsStore } from "@/state/objects";
import { GetDefaultDownloadDir, SelectLocalFolder } from "@wailsjs/go/app/App";
import { objects as ObjectModels } from "@wailsjs/go/models";
import { FolderSearch2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type DownloadOptionsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objects: ObjectModel[];
  prefix: string;
};

const formatSize = (size: number) => {
  if (size <= 0) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

const relativePath = (key: string, prefix: string) => {
  if (prefix && key.startsWith(prefix)) {
    const trimmed = key.slice(prefix.length);
    return trimmed || key;
  }
  return key;
};

export function DownloadOptionsDialog({
  open,
  onOpenChange,
  objects,
  prefix,
}: DownloadOptionsDialogProps) {
  const { t } = useTranslation();
  const accountId = useObjectsStore((s) => s.accountId);
  const bucket = useObjectsStore((s) => s.bucket);
  const [targetDir, setTargetDir] = useState<string>("");
  const [archiveName, setArchiveName] = useState<string>("");
  const [conflictStrategy, setConflictStrategy] = useState<"overwrite" | "rename">("rename");
  const [error, setError] = useState<string>();

  const { downloadBatch } = useObjectMutations(accountId, bucket);

  const totalSize = useMemo(() => {
    return objects.reduce((sum, object) => sum + (object.size ?? 0), 0);
  }, [objects]);

  // Load default download directory when dialog opens
  useEffect(() => {
    if (open && !targetDir) {
      GetDefaultDownloadDir()
        .then((dir) => {
          if (dir) setTargetDir(dir);
        })
        .catch(console.error);
    }
  }, [open, targetDir]);

  const resetState = () => {
    setTargetDir("");
    setArchiveName("");
    setConflictStrategy("rename");
    setError(undefined);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handlePickDirectory = async () => {
    try {
      const dir = await SelectLocalFolder(t("objects.downloadOptions.dialog.selectDir"));
      if (dir) {
        setTargetDir(dir);
      }
    } catch (err) {
      console.error(err);
      showWarning(t("objects.downloadOptions.warning.noLocalSelect"));
    }
  };

  const handleDownload = async () => {
    if (!bucket || objects.length === 0) return;
    setError(undefined);
    try {
      const entries = objects.map((object) => ({
        bucket,
        key: object.key,
        relativePath: relativePath(object.key, prefix),
        size: object.size ?? 0,
        versionId: object.versionId,
        isDir: Boolean(object.isDir),
      }));
      const payload = ObjectModels.DownloadBatchInput.createFrom({
        bucket,
        entries,
        targetDirectory: targetDir,
        archiveName,
        conflictStrategy,
      });
      await downloadBatch.mutateAsync(payload);
      objectsStore.clearSelection();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("objects.downloadOptions.error.failed"));
    }
  };

  const disableSubmit = objects.length === 0 || downloadBatch.isPending;

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? handleClose() : onOpenChange(value))}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("objects.downloadOptions.title")}</DialogTitle>
          <DialogDescription>
            {t("objects.downloadOptions.description", { count: objects.length })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>{t("objects.downloadOptions.label.selected")}</span>
              <span className="font-medium">{objects.length}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>{t("objects.downloadOptions.label.totalSize")}</span>
              <span>{formatSize(totalSize)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("objects.downloadOptions.label.targetDir")}</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground truncate">
                {targetDir || t("objects.downloadOptions.placeholder.targetDir")}
              </div>
              <Button variant="outline" onClick={handlePickDirectory}>
                <FolderSearch2 className="mr-2 h-4 w-4" />{" "}
                {t("objects.downloadOptions.button.browse")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("objects.downloadOptions.label.archiveName")}</Label>
            <Input
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value)}
              placeholder={t("objects.downloadOptions.placeholder.archiveName")}
            />
            <p className="text-xs text-muted-foreground">
              {t("objects.downloadOptions.hint.archiveName")}
            </p>
          </div>

          <div className="space-y-2">
            <Label>{t("objects.downloadOptions.label.conflict")}</Label>
            <RadioGroup
              value={conflictStrategy}
              onValueChange={(value) => setConflictStrategy(value as typeof conflictStrategy)}
              className="grid gap-3 md:grid-cols-2"
            >
              <Label
                className="flex cursor-pointer flex-col gap-1 rounded-md border p-3"
                htmlFor="overwrite"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="overwrite" id="overwrite" />
                  {t("objects.downloadOptions.conflict.overwrite")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("objects.downloadOptions.conflict.overwriteDesc")}
                </p>
              </Label>
              <Label
                className="flex cursor-pointer flex-col gap-1 rounded-md border p-3"
                htmlFor="rename"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="rename" id="rename" />
                  {t("objects.downloadOptions.conflict.rename")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("objects.downloadOptions.conflict.renameDesc")}
                </p>
              </Label>
            </RadioGroup>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={downloadBatch.isPending}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleDownload} disabled={disableSubmit}>
            {downloadBatch.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("objects.downloadOptions.button.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
