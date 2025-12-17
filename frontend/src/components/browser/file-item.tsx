import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Folder, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BaseItem } from "./base-item";
import { FileContextMenuItems } from "./file-context-menu";
import { deriveLabel, getFileIcon } from "./file-utils";

export type FileItemObject = {
  key: string;
  size?: number;
  isDir?: boolean;
  isSymlink?: boolean;
  symlinkTarget?: string;
};

export type FileItemProps = {
  object: FileItemObject;
  prefix: string;
  viewMode: "grid" | "list";
  selected?: boolean;
  onToggleSelect?: (key: string) => void;
  onEnterFolder: (key: string) => void;
  onPreview: (key: string) => void;
  onDownload: (key: string) => void;
  onCopyLink: (key: string) => void;
  onDelete: (key: string) => void;
};

export function FileItem({
  object,
  prefix,
  viewMode,
  selected = false,
  onToggleSelect,
  onEnterFolder,
  onPreview,
  onDownload,
  onCopyLink,
  onDelete,
}: FileItemProps) {
  const { t } = useTranslation("common");
  const label = deriveLabel(object.key, prefix);
  const isDir = object.isDir;

  const icon = isDir ? (
    <Folder className={cn("text-primary", viewMode === "grid" ? "h-12 w-12" : "h-5 w-5")} />
  ) : (
    getFileIcon(object.key, viewMode === "grid" ? "h-12 w-12" : "h-5 w-5")
  );

  const badge =
    !isDir && object.isSymlink ? (
      <Link2 className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-background/90 p-0.5 text-primary shadow" />
    ) : undefined;

  const menuItems = (
    <FileContextMenuItems
      itemKey={object.key}
      isDir={isDir}
      onEnter={onEnterFolder}
      onPreview={onPreview}
      onDownload={onDownload}
      onCopyLink={onCopyLink}
      onDelete={onDelete}
    />
  );

  // Checkbox overlay for grid view when selection is enabled
  const checkbox =
    viewMode === "grid" && onToggleSelect ? (
      <div
        className="absolute left-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(object.key);
        }}
      >
        <Checkbox
          checked={selected}
          className={cn(
            "h-5 w-5 border-2 bg-background/95 shadow-md backdrop-blur-sm",
            selected && "opacity-100",
          )}
          aria-label={t("table.selectItem", "Select item")}
        />
      </div>
    ) : undefined;

  return (
    <BaseItem
      viewMode={viewMode}
      label={label}
      icon={icon}
      iconBackground={isDir ? "bg-primary/10" : "bg-muted/50"}
      badge={badge}
      overlay={checkbox}
      onClick={
        onToggleSelect && viewMode === "grid"
          ? (e) => {
              if (e?.ctrlKey || e?.metaKey) {
                onToggleSelect(object.key);
              }
              // In grid mode, simple click should strictly select or do nothing, leaving navigation to double-click
              // This aligns with standard file explorer behavior
            }
          : undefined
      }
      onDoubleClick={() => {
        if (isDir) {
          onEnterFolder(object.key);
        } else {
          onPreview(object.key);
        }
      }}
      clickable={isDir || (viewMode === "grid" && !!onToggleSelect)}
      selected={selected}
      menuItems={menuItems}
    />
  );
}
