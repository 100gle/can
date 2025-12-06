import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { UploadProgress } from "@/components/transfer/upload-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const statusVariant: Record<string, "default" | "outline" | "success"> = {
  pending: "outline",
  running: "default",
  paused: "outline",
  completed: "success",
  failed: "outline",
  canceled: "outline",
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>任务</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>进度</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.length ? (
                  tasks.map((task) => {
                    const percent = task.total
                      ? Math.min(100, Math.round((task.progress / task.total) * 100))
                      : 0;
                    const label = statusLabel[task.status] || task.status;
                    const variant = statusVariant[task.status] || "outline";
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <p className="font-semibold">{task.name}</p>
                          <p className="text-xs text-muted-foreground">{task.bucket}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {task.type === "upload" ? "上传" : "下载"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{percent}%</span>
                              <span>
                                {formatBytes(task.progress)} / {formatBytes(task.total)}
                              </span>
                            </div>
                            <Progress value={percent} className="h-1.5" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={variant}>{label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
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
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      暂无传输任务。
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </section>
      </main>
    </DashboardLayout>
  );
}
