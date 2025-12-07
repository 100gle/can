import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { objectsStore, useObjectsStore } from "@/state/objects";
import { Copy, Download, FileDown, Loader2, Settings2, Trash2, X } from "lucide-react";

type BatchToolbarProps = {
  className?: string;
  onBatchDownload?: () => void;
  onBatchDelete?: () => void;
  onBatchEdit?: () => void;
  onBatchMoveCopy?: () => void;
  onBatchExport?: () => void;
};

export function BatchToolbar({
  className,
  onBatchDownload,
  onBatchDelete,
  onBatchEdit,
  onBatchMoveCopy,
  onBatchExport,
}: BatchToolbarProps) {
  const selectedKeys = useObjectsStore((s) => s.selectedKeys);
  const selecting = useObjectsStore((s) => s.selecting);
  const count = selectedKeys.size;

  if (count === 0) return null;

  const handleBatchDelete = async () => {
    if (onBatchDelete) {
      onBatchDelete();
    } else {
      await objectsStore.deleteSelected();
    }
  };

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2",
          className,
        )}
      >
        <span className="text-sm font-medium text-primary">已选择 {count} 项</span>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={onBatchDownload}
                disabled={selecting}
              >
                <Download className="h-4 w-4" />
                下载
              </Button>
            </TooltipTrigger>
            <TooltipContent>批量下载选中的文件</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={onBatchEdit}
                disabled={selecting}
              >
                <Settings2 className="h-4 w-4" />
                属性
              </Button>
            </TooltipTrigger>
            <TooltipContent>批量编辑标签、存储类型、ACL</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={onBatchMoveCopy}
                disabled={selecting}
              >
                <Copy className="h-4 w-4" />
                复制/移动
              </Button>
            </TooltipTrigger>
            <TooltipContent>移动或复制选中的文件</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={onBatchExport}
                disabled={selecting}
              >
                <FileDown className="h-4 w-4" />
                导出
              </Button>
            </TooltipTrigger>
            <TooltipContent>导出选中文件的列表</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={handleBatchDelete}
                disabled={selecting}
              >
                {selecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                删除
              </Button>
            </TooltipTrigger>
            <TooltipContent>批量删除选中的文件</TooltipContent>
          </Tooltip>
        </div>

        <div className="ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => objectsStore.clearSelection()}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>清除选择</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
