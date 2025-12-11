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
import { useTranslation } from "react-i18next";

type RenameDialogProps = {
  open: boolean;
  objectKey?: string;
  prefix?: string;
  onOpenChange: (open: boolean) => void;
};

export function RenameDialog({ open, objectKey, prefix, onOpenChange }: RenameDialogProps) {
  const { t } = useTranslation();
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
    if (!trimmed) return t("objects.rename.error.empty");
    if (trimmed.includes("/")) return t("objects.rename.error.slash");
    if (trimmed === getBasename(objectKey || "")) return t("objects.rename.error.same");
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
      setError(e instanceof Error ? e.message : t("objects.rename.error.failed"));
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
            {t("objects.rename.title")}
          </DialogTitle>
          <DialogDescription className="truncate">
            {t("objects.rename.description", { name: objectKey && getBasename(objectKey) })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">{t("objects.rename.label.newName")}</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError(undefined);
              }}
              placeholder={t("objects.rename.placeholder.newName")}
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
            {t("objects.rename.button.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !newName.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("objects.rename.button.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
