import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { DatabaseZap, Download, Eye, Folder, Link2, Settings2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export type FileContextMenuProps = {
  itemKey: string;
  isDir?: boolean;
  onEnter: (key: string) => void;
  onPreview: (key: string) => void;
  onDownload: (key: string) => void;
  onCopyLink: (key: string) => void;
  onDelete: (key: string) => void;
};

export function FileContextMenuItems({
  itemKey,
  isDir,
  onEnter,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
}: FileContextMenuProps) {
  const { t } = useTranslation("common");

  return (
    <>
      {isDir ? (
        <ContextMenuItem onClick={() => onEnter(itemKey)}>
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
    </>
  );
}

export type BucketContextMenuProps = {
  bucketName: string;
  onEnter: (name: string) => void;
  onSettings?: (name: string) => void;
  onDelete: (name: string) => void;
};

export function BucketContextMenuItems({
  bucketName,
  onEnter,
  onSettings,
  onDelete,
}: BucketContextMenuProps) {
  const { t } = useTranslation("common");

  return (
    <>
      <ContextMenuItem onClick={() => onEnter(bucketName)}>
        <DatabaseZap className="mr-2 h-4 w-4" />
        {t("contextMenu.enter")}
      </ContextMenuItem>
      {onSettings && (
        <ContextMenuItem onClick={() => onSettings(bucketName)}>
          <Settings2 className="mr-2 h-4 w-4" />
          {t("common.settings")}
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => onDelete(bucketName)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {t("common.delete")}
      </ContextMenuItem>
    </>
  );
}
