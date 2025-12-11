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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const finalKeyPreview = `${prefix || "/"}${symlinkName}`.replace(/\/{2,}/g, "/");

  const handleCreate = async () => {
    if (!accountId || !bucket) {
      onError?.(t("symlink.error.missingContext"));
      return;
    }
    const trimmedName = symlinkName.trim();
    const trimmedTarget = symlinkTargetKey.trim();
    if (!trimmedName || !trimmedTarget) {
      onError?.(t("symlink.error.missingFields"));
      return;
    }
    const linkKey = `${prefix}${trimmedName}`.replace(/\/{2,}/g, "/");
    setSaving(true);
    try {
      await CreateSymlink(accountId, bucket, linkKey, trimmedTarget);
      toast.success(t("symlink.success"));
      onOpenChange(false);
      setSymlinkName("");
      setSymlinkTargetKey("");
      await objectsStore.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("symlink.error.createFailed");
      onError?.(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("symlink.title")}</DialogTitle>
          <DialogDescription>{t("symlink.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("symlink.name.label")}</Label>
            <Input
              placeholder={t("symlink.name.placeholder")}
              value={symlinkName}
              onChange={(e) => setSymlinkName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("symlink.name.helper", { key: finalKeyPreview })}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("symlink.target.label")}</Label>
            <Input
              placeholder={t("symlink.target.placeholder")}
              value={symlinkTargetKey}
              onChange={(e) => setSymlinkTargetKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("symlink.target.helper")}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !symlinkName.trim() || !symlinkTargetKey.trim() || !bucket}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("symlink.action.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
