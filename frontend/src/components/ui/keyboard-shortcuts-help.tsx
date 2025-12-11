import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KEYBOARD_SHORTCUTS, getShortcutKey } from "@/hooks/use-keyboard-shortcuts";
import { Keyboard } from "lucide-react";
import { useTranslation } from "react-i18next";

type KeyboardShortcutsHelpProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: boolean;
};

export function KeyboardShortcutsHelp({
  open,
  onOpenChange,
  triggerButton = true,
}: KeyboardShortcutsHelpProps) {
  const { t } = useTranslation();

  const content = (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Keyboard className="h-5 w-5" />
          {t("ui.shortcuts.title")}
        </DialogTitle>
        <DialogDescription>{t("ui.shortcuts.description")}</DialogDescription>
      </DialogHeader>

      <div className="space-y-1 py-2">
        {KEYBOARD_SHORTCUTS.map((shortcut) => (
          <div
            key={shortcut.action}
            className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-muted/50"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{shortcut.label}</span>
              <span className="text-xs text-muted-foreground">{shortcut.description}</span>
            </div>
            <kbd className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
              {getShortcutKey(shortcut.action)}
            </kbd>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground pt-2 border-t border-border/40">
        {t("ui.shortcuts.hintPrefix")}{" "}
        <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
          ?
        </kbd>{" "}
        {t("ui.shortcuts.hintSuffix")}
      </p>
    </DialogContent>
  );

  if (triggerButton) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Keyboard className="h-4 w-4" />
            {t("ui.shortcuts.title")}
          </Button>
        </DialogTrigger>
        {content}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {content}
    </Dialog>
  );
}
