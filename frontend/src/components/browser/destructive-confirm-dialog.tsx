import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

interface DestructiveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
  isDeleting?: boolean;
}

export function DestructiveConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "confirm",
  onConfirm,
  isDeleting = false,
}: DestructiveConfirmDialogProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");

  const handleConfirm = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (input !== confirmText) return;

      await onConfirm();
      onOpenChange(false);
      setInput("");
    },
    [input, confirmText, onConfirm, onOpenChange],
  );

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setInput("");
    }
    onOpenChange(newOpen);
  };

  const isMatch = input === confirmText;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-start gap-2 text-destructive">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 pt-2">
            <div>{description}</div>
            <div className="bg-muted/50 rounded-md border p-3 text-sm">
              <p className="mb-2 font-medium text-foreground">
                {t("actions.delete.typeToConfirm", { text: confirmText })}
              </p>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("actions.delete.placeholder", { text: confirmText })}
                className="bg-background"
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-all"
          >
            {isDeleting ? t("common.loading") : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
