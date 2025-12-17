import { PageHeader } from "@/components/layouts/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  type TransferViewModel,
  useTransferActions,
  useTransferTasksPaged,
} from "@/hooks/useTransfers";
import { formatBytes } from "@/lib/utils";
import { ShowPathInFileManager } from "@wailsjs/go/app/App";
import type { TFunction } from "i18next";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { memo, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

const getTaskProgressRatio = (task: TransferViewModel) => {
  if (!task.total || task.total <= 0) {
    return 0;
  }
  return task.progress / task.total;
};

export const TransfersPage = () => {
  const { t } = useTranslation();
  const { isOnline } = useNetworkStatus();
  const actions = useTransferActions();

  // Pagination state
  const [page, setPage] = useState(1);
  const tasksQuery = useTransferTasksPaged(page, PAGE_SIZE);
  const taskList = tasksQuery.data?.tasks ?? [];
  const total = tasksQuery.data?.total ?? 0;
  const totalPages = tasksQuery.data?.totalPages ?? 1;
  const loading = tasksQuery.isPending;

  const handleClearCompleted = useCallback(() => {
    actions.clearCompleted(undefined, {
      onSuccess: () => void tasksQuery.refetch(),
    });
  }, [tasksQuery, actions]);

  const handlePauseTask = useCallback(
    (id: string) => {
      actions.pause(id);
    },
    [actions],
  );

  const handleResumeTask = useCallback(
    (id: string) => {
      actions.resume(id);
    },
    [actions],
  );

  const handleCancelTask = useCallback(
    (id: string) => {
      actions.cancel(id);
    },
    [actions],
  );

  const handleDeleteTask = useCallback(
    (id: string) => {
      actions.remove(id, {
        onSuccess: () => void tasksQuery.refetch(),
      });
    },
    [tasksQuery, actions],
  );

  const handlePrevPage = useCallback(() => {
    if (page > 1) setPage(page - 1);
  }, [page]);

  const handleNextPage = useCallback(() => {
    if (page < totalPages) setPage(page + 1);
  }, [page, totalPages]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t("transfers.title")}
        description={t("transfers.description")}
        showBack
        actions={
          <Button variant="secondary" size="sm" onClick={handleClearCompleted} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t("transfers.clearCompleted")}
          </Button>
        }
      />

      {!isOnline && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          ⏸️ <span className="font-semibold">{t("transfers.offline.paused")}</span> · Offline paused
          -{t("transfers.offline.description")}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("transfers.queue.title")}</CardTitle>
          <CardDescription>{t("transfers.queue.count", { count: total })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              {t("loading")}
            </div>
          ) : taskList.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
              <CloudOff className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">{t("transfers.queue.empty")}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t("transfers.queue.emptyDesc")}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("transfers.table.name")}</TableHead>
                    <TableHead>{t("transfers.table.type")}</TableHead>
                    <TableHead>{t("transfers.table.status")}</TableHead>
                    <TableHead className="w-[200px]">{t("transfers.table.progress")}</TableHead>
                    <TableHead>{t("transfers.table.speedEta")}</TableHead>
                    <TableHead className="text-right">{t("transfers.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskList.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      t={t}
                      onPause={handlePauseTask}
                      onResume={handleResumeTask}
                      onCancel={handleCancelTask}
                      onDelete={handleDeleteTask}
                    />
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    {t("transfers.pagination.info", { page, totalPages, total })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePrevPage}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("transfers.pagination.prev")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={page >= totalPages}
                    >
                      {t("transfers.pagination.next")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransfersPage;

type TaskRowProps = {
  task: TransferViewModel;
  t: TFunction;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
};

const TaskRow = memo(function TaskRow({
  task,
  t,
  onPause,
  onResume,
  onCancel,
  onDelete,
}: TaskRowProps) {
  const progressRatio = getTaskProgressRatio(task);
  const progressPercent = progressRatio * 100;
  const formattedTotal = task.total > 0 ? formatBytes(task.total) : null;

  // Get translated status text
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: t("transfers.status.pending"),
      running: t("transfers.status.running"),
      paused: t("transfers.status.paused"),
      completed: t("transfers.status.completed"),
      failed: t("transfers.status.failed"),
      canceled: t("transfers.status.canceled"),
    };
    return statusMap[status] || status;
  };

  // Get badge variant based on status
  const getBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "running":
        return "default";
      case "failed":
        return "destructive";
      case "paused":
        return "secondary";
      case "canceled":
        return "outline";
      default:
        return "outline";
    }
  };

  return (
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="font-medium max-w-[300px]">
        {task.status === "completed" && task.localPath ? (
          <button
            type="button"
            className="text-left hover:text-primary hover:underline transition-colors cursor-pointer truncate block max-w-full"
            onClick={() => ShowPathInFileManager(task.localPath!)}
          >
            {task.name}
          </button>
        ) : (
          <span className="truncate block">{task.name}</span>
        )}
      </TableCell>
      <TableCell>
        {task.type === "upload" ? (
          <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <ArrowUpCircle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">{t("transfers.type.upload")}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <ArrowDownCircle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">{t("common.download")}</span>
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={
            getBadgeVariant(task.status) as
              | "default"
              | "destructive"
              | "outline"
              | "secondary"
              | "success"
          }
        >
          {getStatusText(task.status)}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="space-y-1.5 min-w-[180px]">
          <Progress
            value={progressPercent}
            className={`h-2 ${task.status === "failed" ? "[&>div]:bg-destructive" : ""}`}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="font-medium">{progressPercent.toFixed(0)}%</span>
            <span>
              {formatBytes(task.progress)}
              {formattedTotal ? ` / ${formattedTotal}` : ""}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {task.status === "running" && task.speed ? (
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="font-medium text-foreground">{formatBytes(task.speed)}/s</span>
            <span>{task.eta ? t("transfers.eta", { eta: task.eta }) : "-"}</span>
          </div>
        ) : (
          <span className="text-xs">-</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          {task.status === "running" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onPause(task.id)}
                title={t("transfers.action.pause")}
              >
                <Pause className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onCancel(task.id)}
                title={t("common.cancel")}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          {task.status === "paused" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onResume(task.id)}
                title={t("transfers.action.resume")}
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onCancel(task.id)}
                title={t("common.cancel")}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
          {(task.status === "failed" ||
            task.status === "canceled" ||
            task.status === "completed") && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(task.id)}
              title={t("common.delete")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
