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
import { Edit3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type RenameDialogProps = {
  open: boolean;
  objectKey?: string;
  prefix?: string;
  onOpenChange: (open: boolean) => void;
};

export function RenameDialog({ open, objectKey, prefix, onOpenChange }: RenameDialogProps) {
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Extract basename from key (without prefix)
  const getBasename = (key: string) => {
    const relativePath = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
    return relativePath.replace(/\/$/, "");
  };

  useEffect(() => {
    if (open && objectKey) {
      setNewName(getBasename(objectKey));
      setError(undefined);
    }
  }, [open, objectKey, prefix]);

  const handleClose = () => {
    setNewName("");
    setError(undefined);
    onOpenChange(false);
  };

  const validate = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (!trimmed) return "名称不能为空";
    if (trimmed.includes("/")) return "名称不能包含斜杠";
    if (trimmed === getBasename(objectKey || "")) return "新名称与原名称相同";
    return undefined;
  };

  const handleSubmit = async () => {
    if (!objectKey) return;

    const validationError = validate(newName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const newKey = (prefix || "") + newName.trim();
      await objectsStore.renameObject(objectKey, newKey);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "重命名失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            重命名
          </DialogTitle>
          <DialogDescription className="truncate">
            将 "{objectKey && getBasename(objectKey)}" 重命名为新名称
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">新名称</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError(undefined);
              }}
              placeholder="输入新名称"
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
          <Button onClick={handleSubmit} disabled={loading || !newName.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            重命名
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
