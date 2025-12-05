import { useMemo } from "react";
import { Pause, Play, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTransfersStore, transfersStore } from "@/state/transfers";

const activeStatuses = new Set<TaskStatus>(["pending", "running", "paused"]);

type TaskStatus = "pending" | "running" | "paused" | "completed" | "failed" | "canceled";

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

export const UploadProgress = () => {
  const tasks = useTransfersStore((state) => Object.values(state.tasks));
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
          <p className="text-xs uppercase tracking-widest text-muted-foreground">传输队列</p>
          <h3 className="text-lg font-semibold">
            {running.length} 个任务 · {percent}%
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatBytes(progress)} / {formatBytes(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => transfersStore.syncBackendTasks()}>
            刷新
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => transfersStore.clearCompleted()}
            title="清除已完成任务"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-4 space-y-3">
        {topTasks.map((task) => {
          const taskPercent = task.total ? Math.min(100, Math.round((task.progress / task.total) * 100)) : 0;
          return (
            <div key={task.id} className="rounded-xl border border-border/30 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{task.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.type === "upload" ? "上传" : "下载"} · {task.bucket}
                  </p>
                </div>
                <div className="flex gap-2">
                  {task.status === "paused" ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => transfersStore.resumeTask(task.id)}
                      title="继续"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => transfersStore.pauseTask(task.id)}
                      title="暂停"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => transfersStore.cancelTask(task.id)}
                    title="取消"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${taskPercent}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>
                  {formatBytes(task.progress)} / {formatBytes(task.total)}
                </span>
                <span>
                  {task.status === "paused"
                    ? "已暂停"
                    : task.speed
                      ? `${formatBytes(task.speed)}/s`
                      : "准备中"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
