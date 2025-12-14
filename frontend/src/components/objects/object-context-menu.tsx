import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import type { ObjectModel } from "@/state/objects";
import {
  CheckSquare,
  DownloadCloud,
  Edit3,
  Focus,
  Info,
  Link2,
  MoveRight,
  Share2,
  Square,
  Trash2,
} from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type ObjectContextMenuProps = {
  object: ObjectModel;
  isSelected: boolean;
  onSelectToggle: () => void;
  onSelectOnly: () => void;
  onDownload?: () => void;
  onCopyLink?: () => void;
  onShare?: () => void;
  onDetails?: () => void;
  onRename?: () => void;
  onMoveCopy?: () => void;
  onDelete?: () => void;
  children: ReactNode;
  className?: string;
};

export function ObjectContextMenu({
  object: _object,
  isSelected,
  onSelectToggle,
  onSelectOnly,
  onDownload,
  onCopyLink,
  onShare,
  onDetails,
  onRename,
  onMoveCopy,
  onDelete,
  children,
  className,
}: ObjectContextMenuProps) {
  const { t } = useTranslation();

  const handle = (callback?: () => void) => (event: Event) => {
    event.preventDefault();
    if (!callback) return;
    callback();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild className={cn("w-full", className)}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem inset onSelect={handle(onSelectToggle)}>
          {isSelected ? (
            <CheckSquare className="mr-2 h-4 w-4" />
          ) : (
            <Square className="mr-2 h-4 w-4" />
          )}
          {isSelected ? t("objects.context.deselect") : t("objects.context.select")}
        </ContextMenuItem>
        <ContextMenuItem inset onSelect={handle(onSelectOnly)}>
          <Focus className="mr-2 h-4 w-4" />
          {t("objects.context.selectOnly")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem inset disabled={!onDownload} onSelect={handle(onDownload)}>
          <DownloadCloud className="mr-2 h-4 w-4" /> {t("common.download")}
        </ContextMenuItem>
        <ContextMenuItem inset disabled={!onCopyLink} onSelect={handle(onCopyLink)}>
          <Link2 className="mr-2 h-4 w-4" /> {t("objects.context.copyLink")}
        </ContextMenuItem>
        <ContextMenuItem inset disabled={!onShare} onSelect={handle(onShare)}>
          <Share2 className="mr-2 h-4 w-4" /> {t("objects.context.shareLink")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem inset onSelect={handle(onDetails)}>
          <Info className="mr-2 h-4 w-4" /> {t("objects.context.details")}
        </ContextMenuItem>
        <ContextMenuItem inset onSelect={handle(onRename)}>
          <Edit3 className="mr-2 h-4 w-4" /> {t("objects.context.rename")}
        </ContextMenuItem>
        <ContextMenuItem inset disabled={!onMoveCopy} onSelect={handle(onMoveCopy)}>
          <MoveRight className="mr-2 h-4 w-4" /> {t("objects.context.moveCopy")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          inset
          className="text-destructive"
          disabled={!onDelete}
          onSelect={handle(onDelete)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> {t("common.delete")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
