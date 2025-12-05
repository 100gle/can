import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { UploadProgress } from "@/components/transfer/upload-progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { transfersStore, useTransfersStore } from "@/state/transfers";
import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, RefreshCcw } from "lucide-react";
import { useEffect, useMemo } from "react";

const statusLabel: Record<string, string> = {
  pending: "排队中",
  running: "进行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  canceled: "已取消",
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

export default function TransfersPage() {
  const params = useParams({ from: "/accounts/$accountId/transfers" });
  const navigate = useNavigate();
  const { accounts } = useAccountsStore((state) => state);
  const taskMap = useTransfersStore((state) => state.tasks);
  const tasks = useMemo(() => Object.values(taskMap), [taskMap]);

  useEffect(() => {
    void accountsStore.bootstrap();
  }, []);

  useEffect(() => {
    transfersStore.startPolling();
    return () => transfersStore.stopPolling();
  }, []);

  const sidebar = (
    <Sidebar
      onCreateAccount={() =>
        navigate({ to: "/accounts/$accountId/dashboard", params: { accountId: params.accountId } })
      }
      onOpenSettings={() => navigate({ to: "/settings" })}
    />
  );

  return (
    <DashboardLayout sidebar={sidebar}>
      <main className="flex flex-1 flex-col overflow-y-auto">
        <header className="border-b border-border/40 bg-background/80 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">传输任务</p>
              <h1 className="text-2xl font-semibold">传输管理</h1>
              <p className="text-sm text-muted-foreground">
                当前账户：{accounts.find((acc) => acc.id === params.accountId)?.name ?? "未选择"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                className="gap-2"
                onClick={() =>
                  navigate({
                    to: "/accounts/$accountId/dashboard",
                    params: { accountId: params.accountId },
                  })
                }
              >
                <ArrowLeft className="h-4 w-4" />
                返回工作台
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => transfersStore.syncBackendTasks()}
              >
                <RefreshCcw className="h-4 w-4" />
                手动刷新
              </Button>
            </div>
          </div>
        </header>

        <section className="space-y-4 p-4">
          <UploadProgress />
          <Card className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">任务</th>
                  <th className="px-4 py-3 text-left">类型</th>
                  <th className="px-4 py-3 text-left">进度</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length ? (
                  tasks.map((task) => {
                    const percent = task.total
                      ? Math.min(100, Math.round((task.progress / task.total) * 100))
                      : 0;
                    const label = statusLabel[task.status] || task.status;
                    return (
                      <tr key={task.id} className="border-b border-border/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{task.name}</p>
                          <p className="text-xs text-muted-foreground">{task.bucket}</p>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {task.type === "upload" ? "上传" : "下载"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{percent}%</span>
                              <span>
                                {formatBytes(task.progress)} / {formatBytes(task.total)}
                              </span>
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground">
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {task.status === "paused" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => transfersStore.resumeTask(task.id)}
                              >
                                继续
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => transfersStore.pauseTask(task.id)}
                              >
                                暂停
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => transfersStore.cancelTask(task.id)}
                            >
                              删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      暂无传输任务。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </section>
      </main>
    </DashboardLayout>
  );
}
