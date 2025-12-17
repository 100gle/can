import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Download, Eye, Folder, Link2, Trash2 } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";

interface TableRowContextMenuProps {
  itemKey: string;
  isDir: boolean;
  onEnterFolder: (key: string) => void;
  onPreview: (key: string) => void;
  onDownload: (key: string) => void;
  onCopyLink: (key: string) => void;
  onDelete: (key: string) => void;
}

export const TableRowContextMenu = memo(function TableRowContextMenu({
  itemKey,
  isDir,
  onEnterFolder,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
}: TableRowContextMenuProps) {
  const { t } = useTranslation("common");

  return (
    <ContextMenuContent>
      {isDir ? (
        <ContextMenuItem onClick={() => onEnterFolder(itemKey)}>
          <Folder className="mr-2 h-4 w-4" />
          {t("contextMenu.enter")}
        </ContextMenuItem>
      ) : (
        <>
          <ContextMenuItem onClick={() => onPreview(itemKey)}>
            <Eye className="mr-2 h-4 w-4" />
            {t("contextMenu.preview")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDownload(itemKey)}>
            <Download className="mr-2 h-4 w-4" />
            {t("common.download")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyLink(itemKey)}>
            <Link2 className="mr-2 h-4 w-4" />
            {t("contextMenu.copyLink")}
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => onDelete(itemKey)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {t("common.delete")}
      </ContextMenuItem>
    </ContextMenuContent>
  );
});
