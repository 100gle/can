import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { showSuccess } from "@/lib/toast";
import { formatBytes } from "@/lib/utils";
import type { TransferViewModel } from "@/state/transfers";
import { transfersStore, useTransfersStore } from "@/state/transfers";
import {
  ArrowDownCircle,
  Check,
  ExternalLink,
  FolderOpen,
  Loader2,
  Pause,
  Play,
  XCircle,
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

type DownloadsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DownloadsPanel({ open, onOpenChange }: DownloadsPanelProps) {
  const { t } = useTranslation();
  const tasks = useTransfersStore((state) => state.tasks);

  // Filter to only download tasks
  const downloadTasks = Object.values(tasks)
    .filter((t) => t.type === "download")
    .sort((a, b) => {
      // Active first, then by progress
      if (a.status === "running" && b.status !== "running") return -1;
      if (b.status === "running" && a.status !== "running") return 1;
      return b.progress / (b.total || 1) - a.progress / (a.total || 1);
    });

  useEffect(() => {
    if (open) {
      transfersStore.startPolling();
    }
  }, [open]);

  const handleOpenLocation = (localPath?: string) => {
    if (!localPath) return;
    // Use Wails ShowItemInFolder or fallback
    // For now, we'll try to open the containing folder
    const folder = localPath.substring(0, localPath.lastIndexOf("/"));
    if (folder) {
      // This would require a backend call to open file explorer
      // For now just copy path to clipboard
      navigator.clipboard.writeText(folder);
      showSuccess(t("downloads.success.pathCopied", { path: folder }));
    }
  };

  const getStatusBadge = (status: TransferViewModel["status"]) => {
    switch (status) {
      case "completed":
        return (
          <Badge variant="success" className="gap-1">
            <Check className="h-3 w-3" />
            {t("downloads.status.completed")}
          </Badge>
        );
      case "running":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {t("downloads.status.downloading")}
          </Badge>
        );
      case "paused":
        return (
          <Badge variant="outline" className="gap-1">
            <Pause className="h-3 w-3" />
            {t("downloads.status.paused")}
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="gap-1 border-destructive text-destructive">
            <XCircle className="h-3 w-3" />
            {t("downloads.status.failed")}
          </Badge>
        );
      case "canceled":
        return (
          <Badge variant="outline" className="gap-1">
            {t("downloads.status.canceled")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{t("downloads.status.waiting")}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[450px] sm:w-[550px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-green-500" />
            {t("downloads.title")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 h-[calc(100vh-120px)] overflow-y-auto pr-2">
          {downloadTasks.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <ArrowDownCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm font-medium">{t("downloads.empty")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{t("downloads.emptyDesc")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {downloadTasks.map((task) => {
                const progressPercent = task.total > 0 ? (task.progress / task.total) * 100 : 0;

                return (
                  <div key={task.id} className="rounded-lg border p-4 space-y-3">
                    {/* Header: Name and Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate" title={task.key}>
                          {task.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {task.bucket}/{task.key}
                        </p>
                      </div>
                      {getStatusBadge(task.status)}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <Progress value={progressPercent} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{progressPercent.toFixed(1)}%</span>
                        <span>
                          {formatBytes(task.progress)} / {formatBytes(task.total)}
                        </span>
                      </div>
                    </div>

                    {/* Speed and ETA */}
                    {task.status === "running" && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          {t("downloads.label.speed")}:{" "}
                          {task.speed ? `${formatBytes(task.speed)}/s` : "-"}
                        </span>
                        <span>
                          {t("downloads.label.eta")}:{" "}
                          {task.eta ? `${task.eta}${t("downloads.unit.sec")}` : "-"}
                        </span>
                      </div>
                    )}

                    {/* Error Message */}
                    {task.error && <p className="text-xs text-destructive">{task.error}</p>}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                      {task.status === "running" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => transfersStore.pauseTask(task.id)}
                          >
                            <Pause className="h-4 w-4" />
                            {t("downloads.action.pause")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive"
                            onClick={() => transfersStore.cancelTask(task.id)}
                          >
                            <XCircle className="h-4 w-4" />
                            {t("downloads.action.cancel")}
                          </Button>
                        </>
                      )}
                      {task.status === "paused" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => transfersStore.resumeTask(task.id)}
                          >
                            <Play className="h-4 w-4" />
                            {t("downloads.action.resume")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-destructive"
                            onClick={() => transfersStore.cancelTask(task.id)}
                          >
                            <XCircle className="h-4 w-4" />
                            {t("downloads.action.cancel")}
                          </Button>
                        </>
                      )}
                      {task.status === "completed" && task.localPath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleOpenLocation(task.localPath)}
                        >
                          <FolderOpen className="h-4 w-4" />
                          {t("downloads.action.openLocation")}
                        </Button>
                      )}
                      {task.status === "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            // Could open file directly if backend supports
                            if (task.localPath) {
                              navigator.clipboard.writeText(task.localPath);
                            }
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                          {t("downloads.action.copyPath")}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
