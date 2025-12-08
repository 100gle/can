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
import { objectsStore } from "@/state/objects";
import { CreateSymlink } from "@wailsjs/go/app/App";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type SymlinkDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  bucket?: string;
  prefix: string;
  onError?: (message: string) => void;
};

export function SymlinkDialog({
  open,
  onOpenChange,
  accountId,
  bucket,
  prefix,
  onError,
}: SymlinkDialogProps) {
  const [symlinkName, setSymlinkName] = useState("");
  const [symlinkTargetKey, setSymlinkTargetKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!accountId || !bucket) {
      onError?.("请先选择账户和 Bucket");
      return;
    }
    const trimmedName = symlinkName.trim();
    const trimmedTarget = symlinkTargetKey.trim();
    if (!trimmedName || !trimmedTarget) {
      onError?.("请输入软链接名称和目标 Key");
      return;
    }
    const linkKey = `${prefix}${trimmedName}`.replace(/\/{2,}/g, "/");
    setSaving(true);
    try {
      await CreateSymlink(accountId, bucket, linkKey, trimmedTarget);
      toast.success("软链接创建成功");
      onOpenChange(false);
      setSymlinkName("");
      setSymlinkTargetKey("");
      await objectsStore.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建软链接失败";
      onError?.(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建软链接</DialogTitle>
          <DialogDescription>软链接会映射到目标对象，可快速暴露常用路径。</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>软链接名称</Label>
            <Input
              placeholder="latest/report.csv"
              value={symlinkName}
              onChange={(e) => setSymlinkName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              最终 Key: {(prefix || "/") + symlinkName}
            </p>
          </div>
          <div className="space-y-2">
            <Label>目标对象 Key</Label>
            <Input
              placeholder="archives/2025-02/report.csv"
              value={symlinkTargetKey}
              onChange={(e) => setSymlinkTargetKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">填写完整的对象 Key，区分大小写。</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !symlinkName.trim() || !symlinkTargetKey.trim() || !bucket}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
