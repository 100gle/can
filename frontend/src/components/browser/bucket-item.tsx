import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { DatabaseZap, Folder, Settings2, Trash2 } from "lucide-react";
import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BaseItem } from "./base-item";

export type BucketItemProps = {
  bucket: { name: string; region?: string };
  viewMode: "grid" | "list";
  onEnter: (name: string) => void;
  onSettings?: (name: string) => void;
  onDelete: (name: string) => void;
};

export const BucketItem = memo(function BucketItem({
  bucket,
  viewMode,
  onEnter,
  onSettings,
  onDelete,
}: BucketItemProps) {
  const { t } = useTranslation();
  const icon = useMemo(
    () => (
      <DatabaseZap className={cn("text-primary", viewMode === "grid" ? "h-12 w-12" : "h-7 w-7")} />
    ),
    [viewMode],
  );

  const menuItems = useMemo(
    () => (
      <>
        <ContextMenuItem onClick={() => onEnter(bucket.name)}>
          <Folder className="mr-2 h-4 w-4" />
          {t("contextMenu.enter")}
        </ContextMenuItem>
        {onSettings && (
          <ContextMenuItem onClick={() => onSettings(bucket.name)}>
            <Settings2 className="mr-2 h-4 w-4" />
            {t("contextMenu.settings")}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onDelete(bucket.name)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t("contextMenu.delete")}
        </ContextMenuItem>
      </>
    ),
    [bucket.name, onEnter, onSettings, onDelete, t],
  );

  const handleClick = useMemo(() => () => onEnter(bucket.name), [bucket.name, onEnter]);

  return (
    <BaseItem
      viewMode={viewMode}
      label={bucket.name}
      icon={icon}
      iconBackground="bg-primary/10"
      onClick={handleClick}
      menuItems={menuItems}
    />
  );
});
