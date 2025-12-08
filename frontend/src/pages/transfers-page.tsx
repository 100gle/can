import { PageHeader } from "@/components/layouts/page-header";
import { OfflineQueuePanel } from "@/components/objects/offline-queue-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { formatBytes } from "@/lib/utils";
import { offlineQueueStore } from "@/state/offlineQueue";
import type { TransferViewModel } from "@/state/transfers";
import { transfersStore, useTransfersStore } from "@/state/transfers";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CloudOff,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

const getTaskProgressRatio = (task: TransferViewModel) => {
  if (!task.total || task.total <= 0) {
    return 0;
  }
  return task.progress / task.total;
};

const SpeedLimitDialog = () => {
  const globalSpeedLimit = useTransfersStore((state) => state.globalSpeedLimit);
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState("");

  useEffect(() => {
    if (open) {
      setLimit(globalSpeedLimit > 0 ? String(globalSpeedLimit) : "");
    }
  }, [open, globalSpeedLimit]);

  const handleSave = async () => {
    const val = Number.parseInt(limit, 10);
    const bytesPerSec = Number.isNaN(val) || val < 0 ? 0 : val;
    await transfersStore.setGlobalSpeedLimit(bytesPerSec);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          传输设置
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>全局传输速度限制</DialogTitle>
          <DialogDescription>
            限制上传和下载的最大速度 (Bytes/s)。设置为 0 表示不限制。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-right text-sm font-medium">限速值</span>
            <Input
              id="speed-limit"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="col-span-3"
              placeholder="0 (不限制)"
              type="number"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            当前限制: {globalSpeedLimit === 0 ? "无限制" : `${formatBytes(globalSpeedLimit)}/s`}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>保存设置</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const TransfersPage = () => {
  const tasks = useTransfersStore((state) => state.tasks);
  const { isOnline } = useNetworkStatus();
  const taskList = Object.values(tasks).sort(
    (a, b) => getTaskProgressRatio(b) - getTaskProgressRatio(a),
  );

  useEffect(() => {
    transfersStore.startPolling();
    offlineQueueStore.startSyncWorker();

    return () => {
      transfersStore.stopPolling();
      offlineQueueStore.stopSyncWorker();
    };
  }, []);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="传输管理"
        description="查看并管理正在进行的上传 / 下载任务。"
        showBack
        actions={
          <>
            <SpeedLimitDialog />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => transfersStore.clearCompleted()}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              清理已完成
            </Button>
          </>
        }
      />

      {!isOnline && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          ⏸️ <span className="font-semibold">离线暂停</span> · Offline paused -
          传输任务已自动暂停，网络恢复后将自动继续
        </div>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">传输中</TabsTrigger>
          <TabsTrigger value="offline">离线待办</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>传输队列</CardTitle>
              <CardDescription>当前 {taskList.length} 个任务</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {taskList.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                  <CloudOff className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium">暂无传输任务</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    上传或下载文件时任务将在此处显示
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>任务名称</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="w-[200px]">进度</TableHead>
                      <TableHead>速度 / 剩余时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taskList.map((task) => {
                      const progressRatio = getTaskProgressRatio(task);
                      const progressPercent = progressRatio * 100;
                      const formattedTotal = task.total > 0 ? formatBytes(task.total) : null;

                      return (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{task.name}</span>
                              <span className="text-xs text-muted-foreground">{task.bucket}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {task.type === "upload" ? (
                              <div className="flex items-center gap-1 text-blue-500">
                                <ArrowUpCircle className="h-4 w-4" />
                                <span className="text-xs">上传</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-green-500">
                                <ArrowDownCircle className="h-4 w-4" />
                                <span className="text-xs">下载</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                task.status === "completed"
                                  ? "success"
                                  : task.status === "running"
                                    ? "default"
                                    : "outline"
                              }
                            >
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Progress value={progressPercent} className="h-2" />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{progressPercent.toFixed(1)}%</span>
                                <span>
                                  {formatBytes(task.progress)}
                                  {formattedTotal ? ` / ${formattedTotal}` : ""}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {task.status === "running" ? (
                              <div className="flex flex-col gap-1">
                                <span>{task.speed ? `${formatBytes(task.speed)}/s` : "-"}</span>
                                <span>{task.eta ? `约 ${task.eta} 秒` : "-"}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {task.status === "running" ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => transfersStore.pauseTask(task.id)}
                                    title="暂停"
                                  >
                                    <Pause className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => transfersStore.cancelTask(task.id)}
                                    title="取消"
                                  >
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              ) : null}
                              {task.status === "paused" ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => transfersStore.resumeTask(task.id)}
                                    title="继续"
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => transfersStore.cancelTask(task.id)}
                                    title="取消"
                                  >
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              ) : null}
                              {task.status === "failed" ||
                              task.status === "canceled" ||
                              task.status === "completed" ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    // Ideally remove from list, currently just visually handled via clearCompleted
                                  }}
                                  disabled
                                  title="无法操作"
                                >
                                  <Trash2 className="h-4 w-4 opacity-50" />
                                </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offline">
          <OfflineQueuePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TransfersPage;
