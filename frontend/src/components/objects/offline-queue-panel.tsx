import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { OfflineAction } from "@/lib/offline/types";
import { offlineQueueStore, useOfflineQueueStore } from "@/state/offlineQueue";
import { AlertCircle, CheckCircle2, Clock, Loader2, RotateCw, X } from "lucide-react";
import { useEffect } from "react";

const getStatusIcon = (status: string) => {
  switch (status) {
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-600" />;
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "执行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return status;
  }
};

const getActionLabel = (type: string) => {
  switch (type) {
    case "upload":
      return "上传";
    case "delete":
      return "删除";
    case "rename":
      return "重命名";
    case "move":
      return "移动";
    case "create-folder":
      return "创建文件夹";
    default:
      return type;
  }
};

const formatTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return date.toLocaleString();
};

type ActionRowProps = {
  action: OfflineAction;
};

const ActionRow = ({ action }: ActionRowProps) => {
  const handleRetry = async () => {
    await offlineQueueStore.retryAction(action.id);
  };

  const handleCancel = async () => {
    await offlineQueueStore.cancelAction(action.id);
  };

  const getObjectName = () => {
    const { payload, type } = action;
    if (type === "upload" || type === "delete") {
      return payload.key as string;
    }
    if (type === "rename") {
      return `${payload.oldKey} → ${payload.newKey}`;
    }
    if (type === "move") {
      const requests = payload.requests as Array<{ sourceKey: string }>;
      if (requests && requests.length > 0) {
        return requests.length === 1 ? requests[0].sourceKey : `${requests.length} 个对象`;
      }
    }
    return action.bucket;
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-card/30 p-4">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex items-center gap-2">
          {getStatusIcon(action.status)}
          <span className="text-sm font-medium">{getStatusLabel(action.status)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {getActionLabel(action.type)}
            </span>
            <span className="truncate text-sm font-medium">{getObjectName()}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Bucket: {action.bucket}</span>
            <span>•</span>
            <span>{formatTime(action.createdAt)}</span>
            {action.retries > 0 && (
              <>
                <span>•</span>
                <span className="text-yellow-600">重试: {action.retries} 次</span>
              </>
            )}
          </div>
          {action.lastError && (
            <div className="mt-1 text-xs text-red-600">错误: {action.lastError}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {action.status === "failed" && (
          <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1">
            <RotateCw className="h-3 w-3" />
            重试
          </Button>
        )}
        {(action.status === "pending" || action.status === "failed") && (
          <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1">
            <X className="h-3 w-3" />
            取消
          </Button>
        )}
      </div>
    </div>
  );
};

export const OfflineQueuePanel = () => {
  const actions = useOfflineQueueStore((s) => s.actions);
  const syncing = useOfflineQueueStore((s) => s.syncing);
  useEffect(() => {
    offlineQueueStore.startSyncWorker();
    return () => {
      offlineQueueStore.stopSyncWorker();
    };
  }, []);

  const handleClearCompleted = async () => {
    await offlineQueueStore.clearCompleted();
  };

  const handleSyncNow = async () => {
    await offlineQueueStore.syncNow();
  };

  const pendingCount = actions.filter((a) => a.status === "pending").length;
  const completedCount = actions.filter((a) => a.status === "completed").length;
  const failedCount = actions.filter((a) => a.status === "failed").length;

  // Queue capacity warning thresholds
  const MAX_QUEUE_SIZE = 500; // Should match the config in offline/queue.ts
  const WARNING_THRESHOLD = 0.8;
  const showCapacityWarning = actions.length >= MAX_QUEUE_SIZE * WARNING_THRESHOLD;

  return (
    <div className="p-4">
      <Card className="p-6">
        {showCapacityWarning && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              队列接近容量上限 ({actions.length}/{MAX_QUEUE_SIZE})，
              {failedCount > 0 && `其中 ${failedCount} 个失败。`}
              请及时处理或清理已完成项。
            </AlertDescription>
          </Alert>
        )}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">离线待办队列</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              待处理: {pendingCount} 个 · 已完成: {completedCount} 个
            </p>
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearCompleted}>
                清理已完成
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleSyncNow}
              disabled={syncing || pendingCount === 0}
              className="gap-1"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  同步中...
                </>
              ) : (
                <>
                  <RotateCw className="h-3 w-3" />
                  立即同步
                </>
              )}
            </Button>
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 py-12 text-center">
            <p className="text-sm text-muted-foreground">暂无离线队列项</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((action) => (
              <ActionRow key={action.id} action={action} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
