import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TaskStatus, useTransferActions, useTransferTasks } from "@/hooks/useTransfers";
import { Pause, Play, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const activeStatuses = new Set<TaskStatus>(["pending", "running", "paused"]);

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

export const UploadProgress = () => {
  const { t } = useTranslation();
  const { data: taskMap = {}, refetch } = useTransferTasks();
  const actions = useTransferActions();

  const tasks = useMemo(() => Object.values(taskMap), [taskMap]);
  const summary = useMemo(() => {
    const running = tasks.filter((task) => activeStatuses.has(task.status));
    if (!running.length) return null;
    const total = running.reduce((acc, task) => acc + task.total, 0);
    const progress = running.reduce((acc, task) => acc + task.progress, 0);
    const percent = total ? Math.min(100, Math.round((progress / total) * 100)) : 0;
    return { running, total, progress, percent };
  }, [tasks]);

  if (!summary) return null;

  const { running, total, progress, percent } = summary;
  const topTasks = running.slice(0, 3);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("transfers.queue.title")}
          </p>
          <h3 className="text-lg font-semibold">
            {t("transfers.tasksSummary", { count: running.length, percent })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatBytes(progress)} / {formatBytes(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            {t("common.refresh")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => actions.clearCompleted()}
            title={t("transfers.clearCompleted")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <Progress value={percent} />
      </div>
      <div className="mt-4 space-y-3">
        {topTasks.map((task) => {
          const taskPercent = task.total
            ? Math.min(100, Math.round((task.progress / task.total) * 100))
            : 0;
          return (
            <div key={task.id} className="rounded-xl border border-border/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{task.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.type === "upload" ? t("common.upload") : t("common.download")} ·{" "}
                    {task.bucket}
                  </p>
                </div>
                <div className="flex gap-2">
                  {task.status === "paused" ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => actions.resume(task.id)}
                      title={t("transfers.action.resume")}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => actions.pause(task.id)}
                      title={t("transfers.action.pause")}
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => actions.cancel(task.id)}
                    title={t("common.cancel")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <Progress value={taskPercent} className="h-1.5" />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(task.progress)} / {formatBytes(task.total)}
                </span>
                <span>
                  {task.status === "paused"
                    ? t("transfers.status.paused")
                    : task.speed
                      ? `${formatBytes(task.speed)}/s`
                      : t("transfers.status.preparing")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
