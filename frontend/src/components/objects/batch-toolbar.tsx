import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useObjectMutations } from "@/hooks/useObjects";
import { cn } from "@/lib/utils";
import { objectsStore, useObjectsStore } from "@/state/objects";
import { Copy, Download, FileDown, Loader2, Settings2, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const selectedKeys = useObjectsStore((s) => s.selectedKeys);
  const selecting = useObjectsStore((s) => s.selecting);
  const count = selectedKeys.size;

  if (count === 0) return null;

  const accountId = useObjectsStore((s) => s.accountId);
  const bucket = useObjectsStore((s) => s.bucket);
  const { deleteObjects } = useObjectMutations(accountId, bucket);

  const handleBatchDelete = async () => {
    if (onBatchDelete) {
      onBatchDelete();
    } else {
      if (selectedKeys.size > 0) {
        await deleteObjects.mutateAsync(Array.from(selectedKeys));
        objectsStore.clearSelection();
      }
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
        <span className="text-sm font-medium text-primary">
          {t("objects.batchToolbar.selected", { count })}
        </span>

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
                {t("common.download")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("common.downloadTooltip")}</TooltipContent>
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
                {t("objects.batchToolbar.action.edit")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("objects.batchToolbar.action.editTooltip")}</TooltipContent>
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
                {t("objects.batchToolbar.action.move")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("objects.batchToolbar.action.moveTooltip")}</TooltipContent>
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
                {t("objects.batchToolbar.action.export")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("objects.batchToolbar.action.exportTooltip")}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={handleBatchDelete}
                disabled={selecting || deleteObjects.isPending}
              >
                {deleteObjects.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t("common.delete")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("objects.batchToolbar.action.deleteTooltip")}</TooltipContent>
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
            <TooltipContent>{t("objects.batchToolbar.action.clear")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
