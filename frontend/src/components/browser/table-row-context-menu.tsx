import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Download, Eye, Folder, Link2, Trash2 } from "lucide-react";

interface TableRowContextMenuProps {
  isDir: boolean;
  onEnterFolder: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}

export function TableRowContextMenu({
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
        <ContextMenuItem onClick={onEnterFolder}>
          <Folder className="mr-2 h-4 w-4" />
          进入
        </ContextMenuItem>
      ) : (
        <>
          <ContextMenuItem onClick={onPreview}>
            <Eye className="mr-2 h-4 w-4" />
            预览
          </ContextMenuItem>
          <ContextMenuItem onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" />
            下载
          </ContextMenuItem>
          <ContextMenuItem onClick={onCopyLink}>
            <Link2 className="mr-2 h-4 w-4" />
            复制链接
          </ContextMenuItem>
        </>
      )}
      <ContextMenuSeparator />
      <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
        <Trash2 className="mr-2 h-4 w-4" />
        删除
      </ContextMenuItem>
    </ContextMenuContent>
  );
}
