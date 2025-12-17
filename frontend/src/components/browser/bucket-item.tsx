import { cn } from "@/lib/utils";
import { DatabaseZap } from "lucide-react";
import { memo, useMemo } from "react";
import { BaseItem } from "./base-item";
import { BucketContextMenuItems } from "./file-context-menu";

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
  const icon = useMemo(
    () => (
      <DatabaseZap className={cn("text-primary", viewMode === "grid" ? "h-12 w-12" : "h-7 w-7")} />
    ),
    [viewMode],
  );

  const menuItems = useMemo(
    () => (
      <BucketContextMenuItems
        bucketName={bucket.name}
        onEnter={onEnter}
        onSettings={onSettings}
        onDelete={onDelete}
      />
    ),
    [bucket.name, onEnter, onSettings, onDelete],
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
