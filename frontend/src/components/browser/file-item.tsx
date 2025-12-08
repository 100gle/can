import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { Download, Eye, Folder, Link2, Share2, Trash2 } from "lucide-react";
import { BaseItem } from "./base-item";
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
    <>
      {isDir ? (
        <ContextMenuItem onClick={() => onEnterFolder(object.key)}>
          <Folder className="mr-2 h-4 w-4" />
          进入
        </ContextMenuItem>
      ) : (
        <>
          <ContextMenuItem onClick={() => onPreview(object.key)}>
            <Eye className="mr-2 h-4 w-4" />
            预览
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDownload(object.key)}>
            <Download className="mr-2 h-4 w-4" />
            下载
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyLink(object.key)}>
            <Link2 className="mr-2 h-4 w-4" />
            复制链接
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyLink(object.key)}>
            <Share2 className="mr-2 h-4 w-4" />
            分享
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => onDelete(object.key)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        删除
      </ContextMenuItem>
    </>
  );

  // Checkbox overlay for grid view when selection is enabled
  const checkbox = viewMode === "grid" && onToggleSelect ? (
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
          selected && "opacity-100"
        )}
        aria-label="Select item"
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
              } else if (isDir) {
                onEnterFolder(object.key);
              }
            }
          : isDir
            ? () => onEnterFolder(object.key)
            : undefined
      }
      clickable={isDir || (viewMode === "grid" && !!onToggleSelect)}
      selected={selected}
      menuItems={menuItems}
    />
  );
}
