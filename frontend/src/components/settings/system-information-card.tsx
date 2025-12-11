import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatBytes } from "@/lib/utils";
import { useAccountsStore } from "@/state/accounts";
import { CheckForUpdates, GetSystemMetrics } from "@wailsjs/go/app/App";
import { system } from "@wailsjs/go/models";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noreferrer");
};

export function SystemInformationCard() {
  const accounts = useAccountsStore((state) => state.accounts);
  const [metrics, setMetrics] = useState<system.SystemMetrics | null>(null);
  const [updateInfo, setUpdateInfo] = useState<system.UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await GetSystemMetrics();
        setMetrics(data);
      } catch (e) {
        console.error("Failed to fetch system metrics", e);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckUpdates = () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    void CheckForUpdates(APP_VERSION)
      .then((info) => setUpdateInfo(info))
      .catch((error) => {
        const message = error instanceof Error ? error.message : "检查更新失败";
        setUpdateError(message);
      })
      .finally(() => setCheckingUpdate(false));
  };

  const handleOpenIssues = () => openExternalLink(ISSUES_URL);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-lg font-semibold">系统信息</CardTitle>
          <CardDescription className="text-sm">版本、更新、性能监控与反馈</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* About Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">关于</h3>
          </div>
          <div className="grid gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">当前版本</span>
              <span className="font-medium">{APP_VERSION}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">已连接账户</span>
              <span className="font-medium">{accounts.length}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-muted-foreground">遇到问题？</span>
              <Button variant="link" className="h-auto p-0" onClick={handleOpenIssues}>
                提交反馈
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Updates Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">版本更新</h3>
            <p className="text-xs text-muted-foreground">当前版本:{APP_VERSION}</p>
          </div>
          <div className="space-y-3">
            {updateInfo ? (
              updateInfo.updateAvailable ? (
                <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  发现新版本 {updateInfo.latestVersion || "未知版本"}，点击"查看发布页"获取安装包。
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  已是最新版本；若仍需重装，可前往 GitHub Releases。
                </p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">
                尚未检查更新。点击下方按钮开始检测，亦可手动关注 GitHub Releases。
              </p>
            )}
            {updateError && <p className="text-sm text-destructive">{updateError}</p>}
            {updateInfo?.releaseNotes && (
              <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  最新发布说明 / Release Notes
                </p>
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-sm">
                  {updateInfo.releaseNotes}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCheckUpdates} disabled={checkingUpdate} className="gap-2">
                {checkingUpdate && <Loader2 className="h-4 w-4 animate-spin" />}
                检查更新 / Check Updates
              </Button>
              {updateInfo?.updateAvailable && updateInfo.releaseURL ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => openExternalLink(updateInfo.releaseURL)}
                >
                  <ExternalLink className="h-4 w-4" />
                  查看发布页 / Open Release
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Separator />

        {/* Performance Monitoring Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">性能监控</h3>
            <p className="text-xs text-muted-foreground">实时系统指标监控 (每2秒刷新)</p>
          </div>
          {metrics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">内存使用 (Alloc)</p>
                <p className="text-2xl font-bold">{formatBytes(metrics.memoryAlloc)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">系统内存 (Sys)</p>
                <p className="text-2xl font-bold">{formatBytes(metrics.memorySys)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Goroutines</p>
                <p className="text-2xl font-bold">{metrics.numGoroutines}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">活跃传输任务</p>
                <p className="text-2xl font-bold">{metrics.activeTransfers}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading metrics...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
