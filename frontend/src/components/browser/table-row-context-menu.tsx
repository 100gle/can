import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Download, Eye, Folder, Link2, Trash2 } from "lucide-react";
import { memo } from "react";

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
  return (
    <ContextMenuContent>
      {isDir ? (
        <ContextMenuItem onClick={() => onEnterFolder(itemKey)}>
          <Folder className="mr-2 h-4 w-4" />
          进入
        </ContextMenuItem>
      ) : (
        <>
          <ContextMenuItem onClick={() => onPreview(itemKey)}>
            <Eye className="mr-2 h-4 w-4" />
            预览
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDownload(itemKey)}>
            <Download className="mr-2 h-4 w-4" />
            下载
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onCopyLink(itemKey)}>
            <Link2 className="mr-2 h-4 w-4" />
            复制链接
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem
        onClick={() => onDelete(itemKey)}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        删除
      </ContextMenuItem>
    </ContextMenuContent>
  );
});
