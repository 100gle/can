import { useMemo, useState } from "react";
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
import type { ObjectModel } from "@/state/objects";
import { objectsStore, useObjectsStore } from "@/state/objects";
import { objects as ObjectModels } from "@wailsjs/go/models";
import { SelectLocalFolder } from "@wailsjs/go/app/App";
import { Loader2, FolderSearch2 } from "lucide-react";

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
  const bucket = useObjectsStore((s) => s.bucket);
  const [targetDir, setTargetDir] = useState<string>("");
  const [archiveName, setArchiveName] = useState<string>("");
  const [conflictStrategy, setConflictStrategy] = useState<"overwrite" | "rename">("rename");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const totalSize = useMemo(() => {
    return objects.reduce((sum, object) => sum + (object.size ?? 0), 0);
  }, [objects]);

  const resetState = () => {
    setTargetDir("");
    setArchiveName("");
    setConflictStrategy("rename");
    setSubmitting(false);
    setError(undefined);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handlePickDirectory = async () => {
    try {
      const dir = await SelectLocalFolder();
      if (dir) {
        setTargetDir(dir);
      }
    } catch (err) {
      console.error(err);
      window.alert?.("当前环境不支持选择本地目录，请手动输入路径");
    }
  };

  const handleDownload = async () => {
    if (!bucket || objects.length === 0) return;
    setSubmitting(true);
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
      await objectsStore.downloadBatch(payload);
      objectsStore.clearSelection();
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "发起下载失败");
    } finally {
      setSubmitting(false);
    }
  };

  const disableSubmit = objects.length === 0 || submitting;

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? handleClose() : onOpenChange(value))}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>批量下载</DialogTitle>
          <DialogDescription>
            将 {objects.length} 个对象打包为单个归档并落地到本地目录。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span>选择的对象</span>
              <span className="font-medium">{objects.length}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>预估总大小</span>
              <span>{formatSize(totalSize)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>保存目录</Label>
            <div className="flex items-center gap-2">
              <Input
                value={targetDir}
                onChange={(e) => setTargetDir(e.target.value)}
                placeholder="例如 /Users/me/Downloads"
              />
              <Button variant="outline" onClick={handlePickDirectory}>
                <FolderSearch2 className="mr-2 h-4 w-4" /> 浏览
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>归档文件名</Label>
            <Input
              value={archiveName}
              onChange={(e) => setArchiveName(e.target.value)}
              placeholder="可选，默认自动生成"
            />
            <p className="text-xs text-muted-foreground">
              留空将以“download-时间戳.zip”的格式生成。
            </p>
          </div>

          <div className="space-y-2">
            <Label>冲突策略</Label>
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
                  覆盖
                </div>
                <p className="text-xs text-muted-foreground">目标存在同名文件时直接覆盖。</p>
              </Label>
              <Label
                className="flex cursor-pointer flex-col gap-1 rounded-md border p-3"
                htmlFor="rename"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="rename" id="rename" />
                  自动重命名
                </div>
                <p className="text-xs text-muted-foreground">保留原文件，并为新文件追加后缀。</p>
              </Label>
            </RadioGroup>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleDownload} disabled={disableSubmit}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始下载
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
