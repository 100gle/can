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
import { objectsStore, useObjectsStore } from "@/state/objects";
import { FolderPlus, Loader2 } from "lucide-react";
import { useState } from "react";

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateFolderDialog({ open, onOpenChange }: CreateFolderDialogProps) {
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const { objects, prefix } = useObjectsStore((state) => ({
    objects: state.objects,
    prefix: state.prefix,
  }));

  const handleClose = () => {
    setFolderName("");
    setError(undefined);
    onOpenChange(false);
  };

  const validate = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (!trimmed) return "文件夹名称不能为空";
    if (trimmed.includes("/")) return "文件夹名称不能包含斜杠";
    if (trimmed === "." || trimmed === "..") return "无效的文件夹名称";
    const normalized = trimmed.replace(/\/$/, "");
    const duplicateExists = objects.some((object) => {
      if (!object.isDir) return false;
      if (!object.key.startsWith(prefix)) return false;
      const relative = object.key.slice(prefix.length).replace(/\/$/, "");
      return relative === normalized;
    });
    if (duplicateExists) return "当前目录已存在同名文件夹";
    return undefined;
  };

  const handleSubmit = async () => {
    const validationError = validate(folderName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      await objectsStore.createFolder(folderName.trim());
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建文件夹失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            新建文件夹
          </DialogTitle>
          <DialogDescription>在当前目录下创建一个新文件夹（虚拟目录）</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">文件夹名称</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setError(undefined);
              }}
              placeholder="输入文件夹名称"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleSubmit();
                }
              }}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !folderName.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            创建
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
