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
  Info,
  Link2,
  MoveRight,
  Share2,
  Square,
  Trash2,
} from "lucide-react";
import { type ReactNode } from "react";

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
          {isSelected ? "取消选择" : "选择"}
        </ContextMenuItem>
        <ContextMenuItem inset onSelect={handle(onSelectOnly)}>
          仅选择此项
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem inset disabled={!onDownload} onSelect={handle(onDownload)}>
          <DownloadCloud className="mr-2 h-4 w-4" /> 下载
        </ContextMenuItem>
        <ContextMenuItem inset disabled={!onCopyLink} onSelect={handle(onCopyLink)}>
          <Link2 className="mr-2 h-4 w-4" /> 复制直链
        </ContextMenuItem>
        <ContextMenuItem inset disabled={!onShare} onSelect={handle(onShare)}>
          <Share2 className="mr-2 h-4 w-4" /> 分享链接
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem inset onSelect={handle(onDetails)}>
          <Info className="mr-2 h-4 w-4" /> 查看详情
        </ContextMenuItem>
        <ContextMenuItem inset onSelect={handle(onRename)}>
          <Edit3 className="mr-2 h-4 w-4" /> 重命名
        </ContextMenuItem>
        <ContextMenuItem inset disabled={!onMoveCopy} onSelect={handle(onMoveCopy)}>
          <MoveRight className="mr-2 h-4 w-4" /> 复制 / 移动
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          inset
          className="text-destructive"
          disabled={!onDelete}
          onSelect={handle(onDelete)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> 删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
