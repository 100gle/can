import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { OfflineAction } from "@/lib/offline/types";
import { offlineQueueStore, useOfflineQueueStore } from "@/state/offlineQueue";
import { AlertCircle, CheckCircle2, Clock, Loader2, RotateCw, X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

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

const formatTime = (timestamp: number, t: (key: string, options?: any) => string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return t("objects.offlineQueue.row.time.justNow");
  if (minutes < 60) return t("objects.offlineQueue.row.time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("objects.offlineQueue.row.time.hoursAgo", { count: hours });
  return date.toLocaleString();
};

type ActionRowProps = {
  action: OfflineAction;
};

const ActionRow = ({ action }: ActionRowProps) => {
  const { t } = useTranslation();

  const handleRetry = async () => {
    await offlineQueueStore.retryAction(action.id);
  };

  const handleCancel = async () => {
    await offlineQueueStore.cancelAction(action.id);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return t("objects.offlineQueue.status.pending");
      case "running":
        return t("objects.offlineQueue.status.running");
      case "completed":
        return t("objects.offlineQueue.status.completed");
      case "failed":
        return t("objects.offlineQueue.status.failed");
      default:
        return status;
    }
  };

  const getActionLabel = (type: string) => {
    switch (type) {
      case "upload":
        return t("objects.offlineQueue.action.upload");
      case "delete":
        return t("objects.offlineQueue.action.delete");
      case "rename":
        return t("objects.offlineQueue.action.rename");
      case "move":
        return t("objects.offlineQueue.action.move");
      case "create-folder":
        return t("objects.offlineQueue.action.createFolder");
      default:
        return type;
    }
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
            <span>{t("objects.offlineQueue.row.bucket", { bucket: action.bucket })}</span>
            <span>•</span>
            <span>{formatTime(action.createdAt, t)}</span>
            {action.retries > 0 && (
              <>
                <span>•</span>
                <span className="text-yellow-600">
                  {t("objects.offlineQueue.row.retries", { count: action.retries })}
                </span>
              </>
            )}
          </div>
          {action.lastError && (
            <div className="mt-1 text-xs text-red-600">
              {t("objects.offlineQueue.row.error", { error: action.lastError })}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {action.status === "failed" && (
          <Button variant="outline" size="sm" onClick={handleRetry} className="gap-1">
            <RotateCw className="h-3 w-3" />
            {t("objects.offlineQueue.row.retry")}
          </Button>
        )}
        {(action.status === "pending" || action.status === "failed") && (
          <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1">
            <X className="h-3 w-3" />
            {t("objects.offlineQueue.row.cancel")}
          </Button>
        )}
      </div>
    </div>
  );
};

export const OfflineQueuePanel = () => {
  const { t } = useTranslation();
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
              {t("objects.offlineQueue.warning.capacity", {
                current: actions.length,
                max: MAX_QUEUE_SIZE,
                failed: failedCount,
              })}
            </AlertDescription>
          </Alert>
        )}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("objects.offlineQueue.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("objects.offlineQueue.stats.pending", { count: pendingCount })} ·{" "}
              {t("objects.offlineQueue.stats.completed", { count: completedCount })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleClearCompleted}>
                {t("objects.offlineQueue.button.clearCompleted")}
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
                  {t("objects.offlineQueue.button.syncing")}
                </>
              ) : (
                <>
                  <RotateCw className="h-3 w-3" />
                  {t("objects.offlineQueue.button.syncNow")}
                </>
              )}
            </Button>
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("objects.offlineQueue.empty")}</p>
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
