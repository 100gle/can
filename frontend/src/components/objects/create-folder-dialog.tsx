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
import { useTranslation } from "react-i18next";

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateFolderDialog({ open, onOpenChange }: CreateFolderDialogProps) {
  const { t } = useTranslation();
  const [folderName, setFolderName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  // Use individual selectors to avoid new object reference issue with React 19
  const objects = useObjectsStore((state) => state.objects);
  const prefix = useObjectsStore((state) => state.prefix);

  const handleClose = () => {
    setFolderName("");
    setError(undefined);
    onOpenChange(false);
  };

  const validate = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (!trimmed) return t("objects.createFolder.error.empty");
    if (trimmed.includes("/")) return t("objects.createFolder.error.slash");
    if (trimmed === "." || trimmed === "..") return t("objects.createFolder.error.invalid");
    const normalized = trimmed.replace(/\/$/, "");
    const duplicateExists = objects.some((object) => {
      if (!object.isDir) return false;
      if (!object.key.startsWith(prefix)) return false;
      const relative = object.key.slice(prefix.length).replace(/\/$/, "");
      return relative === normalized;
    });
    if (duplicateExists) return t("objects.createFolder.error.exists");
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
      setError(e instanceof Error ? e.message : t("objects.createFolder.error.failed"));
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
            {t("objects.createFolder.title")}
          </DialogTitle>
          <DialogDescription>{t("objects.createFolder.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">{t("objects.createFolder.label.name")}</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => {
                setFolderName(e.target.value);
                setError(undefined);
              }}
              placeholder={t("objects.createFolder.placeholder.name")}
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
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !folderName.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("objects.createFolder.button.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
