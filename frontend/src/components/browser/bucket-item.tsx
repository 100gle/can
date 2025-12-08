import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { DatabaseZap, Folder, Settings2, Trash2 } from "lucide-react";
import { BaseItem } from "./base-item";

export type BucketItemProps = {
  bucket: { name: string; region?: string };
  viewMode: "grid" | "list";
  onEnter: (name: string) => void;
  onSettings?: (name: string) => void;
  onDelete: (name: string) => void;
};

export function BucketItem({ bucket, viewMode, onEnter, onSettings, onDelete }: BucketItemProps) {
  const icon = (
    <DatabaseZap className={cn("text-primary", viewMode === "grid" ? "h-12 w-12" : "h-7 w-7")} />
  );

  const menuItems = (
    <>
      <ContextMenuItem onClick={() => onEnter(bucket.name)}>
        <Folder className="mr-2 h-4 w-4" />
        进入
      </ContextMenuItem>
      {onSettings && (
        <ContextMenuItem onClick={() => onSettings(bucket.name)}>
          <Settings2 className="mr-2 h-4 w-4" />
          设置
        </ContextMenuItem>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => onDelete(bucket.name)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        删除
      </ContextMenuItem>
    </>
  );

  return (
    <BaseItem
      viewMode={viewMode}
      label={bucket.name}
      icon={icon}
      iconBackground="bg-primary/10"
      onClick={() => onEnter(bucket.name)}
      menuItems={menuItems}
    />
  );
}
