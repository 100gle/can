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
import type { TFunction } from "i18next";
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
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const getTaskProgressRatio = (task: TransferViewModel) => {
  if (!task.total || task.total <= 0) {
    return 0;
  }
  return task.progress / task.total;
};

const SpeedLimitDialogContent = ({
  globalSpeedLimit,
  onSave,
}: {
  globalSpeedLimit: number;
  onSave: (limit: number) => void;
}) => {
  const { t } = useTranslation();
  // Initialize state directly from props - no useEffect needed
  const [limit, setLimit] = useState(globalSpeedLimit > 0 ? String(globalSpeedLimit) : "");

  const handleSave = async () => {
    const val = Number.parseInt(limit, 10);
    const bytesPerSec = Number.isNaN(val) || val < 0 ? 0 : val;
    onSave(bytesPerSec);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("transfers.settings.title")}</DialogTitle>
        <DialogDescription>{t("transfers.settings.description")}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <span className="text-right text-sm font-medium">
            {t("transfers.settings.limitLabel")}
          </span>
          <Input
            id="speed-limit"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="col-span-3"
            placeholder={t("transfers.settings.limitPlaceholder")}
            type="number"
          />
        </div>
        <div className="text-xs text-muted-foreground">
          {t("transfers.settings.currentLimit")}:{" "}
          {globalSpeedLimit === 0
            ? t("transfers.settings.unlimited")
            : `${formatBytes(globalSpeedLimit)}/s`}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSave}>{t("transfers.settings.save")}</Button>
      </DialogFooter>
    </>
  );
};

const SpeedLimitDialog = () => {
  const { t } = useTranslation();
  const globalSpeedLimit = useTransfersStore((state) => state.globalSpeedLimit);
  const [open, setOpen] = useState(false);

  const handleSave = useCallback(async (bytesPerSec: number) => {
    await transfersStore.setGlobalSpeedLimit(bytesPerSec);
    setOpen(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          {t("transfers.settings")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        {open && (
          <SpeedLimitDialogContent globalSpeedLimit={globalSpeedLimit} onSave={handleSave} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export const TransfersPage = () => {
  const { t } = useTranslation();
  const tasks = useTransfersStore((state) => state.tasks);
  const { isOnline } = useNetworkStatus();
  const taskList = useMemo(() => {
    return Object.values(tasks).sort((a, b) => getTaskProgressRatio(b) - getTaskProgressRatio(a));
  }, [tasks]);

  const handleClearCompleted = useCallback(() => {
    transfersStore.clearCompleted();
  }, []);

  const handlePauseTask = useCallback((id: string) => {
    void transfersStore.pauseTask(id);
  }, []);

  const handleResumeTask = useCallback((id: string) => {
    void transfersStore.resumeTask(id);
  }, []);

  const handleCancelTask = useCallback((id: string) => {
    void transfersStore.cancelTask(id);
  }, []);

  const handleDeleteTask = useCallback((id: string) => {
    void transfersStore.deleteTask(id);
  }, []);

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
        title={t("transfers.title")}
        description={t("transfers.description")}
        showBack
        actions={
          <>
            <SpeedLimitDialog />
            <Button variant="secondary" size="sm" onClick={handleClearCompleted} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t("transfers.clearCompleted")}
            </Button>
          </>
        }
      />

      {!isOnline && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
          ⏸️ <span className="font-semibold">{t("transfers.offline.paused")}</span> · Offline paused
          -{t("transfers.offline.description")}
        </div>
      )}

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">{t("transfers.tab.active")}</TabsTrigger>
          <TabsTrigger value="offline">{t("transfers.tab.offline")}</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>{t("transfers.queue.title")}</CardTitle>
              <CardDescription>
                {t("transfers.queue.count", { count: taskList.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {taskList.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                  <CloudOff className="h-10 w-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium">{t("transfers.queue.empty")}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {t("transfers.queue.emptyDesc")}
                  </p>
                </div>
              ) : (
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

  return (
    <TableRow>
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
            <span className="text-xs">{t("transfers.type.upload")}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-green-500">
            <ArrowDownCircle className="h-4 w-4" />
            <span className="text-xs">{t("transfers.type.download")}</span>
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
            <span>{task.eta ? t("transfers.eta", { eta: task.eta }) : "-"}</span>
          </div>
        ) : (
          "-"
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {task.status === "running" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPause(task.id)}
                title={t("transfers.action.pause")}
              >
                <Pause className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCancel(task.id)}
                title={t("transfers.action.cancel")}
              >
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
          {task.status === "paused" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onResume(task.id)}
                title={t("transfers.action.resume")}
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onCancel(task.id)}
                title={t("transfers.action.cancel")}
              >
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
          {(task.status === "failed" ||
            task.status === "canceled" ||
            task.status === "completed") && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(task.id)}
              title={t("transfers.action.delete")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});
