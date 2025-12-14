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
import { useState } from "react";
import { useTranslation } from "react-i18next";

type RenameDialogProps = {
  open: boolean;
  objectKey?: string;
  prefix?: string;
  onOpenChange: (open: boolean) => void;
};

export function RenameDialog({ open, objectKey, prefix, onOpenChange }: RenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* Conditional rendering: content only mounts when open, auto-resets state */}
        {open && objectKey && (
          <RenameDialogContent
            objectKey={objectKey}
            prefix={prefix}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type RenameDialogContentProps = {
  objectKey: string;
  prefix?: string;
  onClose: () => void;
};

function RenameDialogContent({ objectKey, prefix, onClose }: RenameDialogContentProps) {
  const { t } = useTranslation();

  // Extract basename from key (without prefix)
  const getBasename = (key: string) => {
    const relativePath = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
    return relativePath.replace(/\/$/, "");
  };

  // Initialize state directly from props - no useEffect needed
  const [newName, setNewName] = useState(getBasename(objectKey));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const validate = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (!trimmed) return t("objects.rename.error.empty");
    if (trimmed.includes("/")) return t("objects.rename.error.slash");
    if (trimmed === getBasename(objectKey)) return t("objects.rename.error.same");
    return undefined;
  };

  const handleSubmit = async () => {
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
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("objects.rename.error.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Edit3 className="h-5 w-5" />
          {t("objects.rename.title")}
        </DialogTitle>
        <DialogDescription className="truncate">
          {t("objects.rename.description", { name: getBasename(objectKey) })}
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
        <Button variant="outline" onClick={onClose} disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={loading || !newName.trim()}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("common.confirm")}
        </Button>
      </DialogFooter>
    </>
  );
}
