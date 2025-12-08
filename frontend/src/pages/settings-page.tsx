import { PageHeader } from "@/components/layouts/page-header";
import { useResolvedTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { offlineCache } from "@/lib/offline";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import {
  DEFAULT_ADVANCED_OPTIONS,
  usePreferencesStore,
  type AdvancedOptions,
  type CacheSize,
  type DatabaseDriver,
  type LogLevel,
  type ThemePreference,
} from "@/state/preferences";
import { useSessionStore } from "@/state/session";
import { transfersStore, useTransfersStore } from "@/state/transfers";
import { CheckForUpdates, GetSystemMetrics } from "@wailsjs/go/app/App";
import { system } from "@wailsjs/go/models";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noreferrer");
};

function PerformanceCard() {
  const [metrics, setMetrics] = useState<system.SystemMetrics | null>(null);

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

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>性能监控</CardTitle>
        <CardDescription>实时系统指标监控 (每2秒刷新)。</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}

function TransferSettingsCard() {
  const workerCount = useTransfersStore((state) => state.workerCount);
  const globalSpeedLimit = useTransfersStore((state) => state.globalSpeedLimit);
  const [speedLimitInput, setSpeedLimitInput] = useState("");

  useEffect(() => {
    if (globalSpeedLimit === 0) {
      setSpeedLimitInput("");
    } else {
      setSpeedLimitInput(String(globalSpeedLimit));
    }
  }, [globalSpeedLimit]);

  const handleWorkerCountChange = (val: number[]) => {
    if (val.length > 0) {
      transfersStore.setWorkerCount(val[0]);
    }
  };

  const handleSpeedLimitBlur = () => {
    const val = parseInt(speedLimitInput);
    if (!isNaN(val) && val >= 0) {
      transfersStore.setGlobalSpeedLimit(val);
    } else {
      // reset to current store value
      setSpeedLimitInput(globalSpeedLimit === 0 ? "" : String(globalSpeedLimit));
      if (speedLimitInput === "") {
        transfersStore.setGlobalSpeedLimit(0);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>传输设置</CardTitle>
        <CardDescription>配置并发任务数和全局限速。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>并发数 (Workers)</Label>
              <span className="text-sm font-medium">{workerCount}</span>
            </div>
            <Slider
              min={1}
              max={16}
              step={1}
              value={[workerCount]}
              onValueChange={handleWorkerCountChange}
            />
            <p className="text-xs text-muted-foreground">
              同时进行的上传/下载任务数量。数值过大可能导致网络拥堵或系统卡顿。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="speed-limit">全局限速 (Bytes/s)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="speed-limit"
                placeholder="0 (无限制)"
                value={speedLimitInput}
                onChange={(e) => setSpeedLimitInput(e.target.value)}
                onBlur={handleSpeedLimitBlur}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {globalSpeedLimit > 0
                  ? (globalSpeedLimit / 1024 / 1024).toFixed(2) + " MB/s"
                  : "无限制"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              限制所有任务的总上传/下载速度 (0 表示不限制)。
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const accounts = useAccountsStore((state) => state.accounts);
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);
  const advancedOptions = usePreferencesStore((state) => state.advancedOptions);
  const setAdvancedOptions = usePreferencesStore((state) => state.setAdvancedOptions);
  const resetAdvancedOptions = usePreferencesStore((state) => state.resetAdvancedOptions);
  const idleTimeoutMinutes = useSessionStore((state) => state.idleTimeoutMinutes);
  const lockStrategy = useSessionStore((state) => state.lockStrategy);
  const setIdleTimeout = useSessionStore((state) => state.setIdleTimeout);
  const setLockStrategy = useSessionStore((state) => state.setLockStrategy);
  const resolvedTheme = useResolvedTheme();
  const [updateInfo, setUpdateInfo] = useState<system.UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [cacheUsage, setCacheUsage] = useState<{ usage: number; quota: number } | null>(null);
  const offlineCacheEnabled = usePreferencesStore((state) => state.offlineCacheEnabled);
  const setOfflineCacheEnabled = usePreferencesStore((state) => state.setOfflineCacheEnabled);
  const offlineCacheSize = usePreferencesStore((state) => state.offlineCacheSize);
  const setOfflineCacheSize = usePreferencesStore((state) => state.setOfflineCacheSize);

  // Backup encryption state
  const [enableBackupEncryption, setEnableBackupEncryption] = useState(false);
  const [showBackupPasswordDialog, setShowBackupPasswordDialog] = useState(false);
  const [showRestorePasswordDialog, setShowRestorePasswordDialog] = useState(false);

  useEffect(() => {
    offlineCache.getUsage().then(setCacheUsage);
  }, []);

  const handleThemeSelection = (value: ThemePreference) => {
    setThemePreference(value);
  };

  const updateAdvancedOptions = (patch: Partial<AdvancedOptions>) => {
    setAdvancedOptions(patch);
  };

  const handleResetAdvanced = () => {
    resetAdvancedOptions();
  };

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

  const handleCreateBackup = () => {
    if (enableBackupEncryption) {
      setShowBackupPasswordDialog(true);
    } else {
      void CreateAppBackup(false, "")
        .then(() => window.alert("备份创建成功"))
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          window.alert(`备份失败: ${message}`);
        });
    }
  };

  const handleCreateEncryptedBackup = (password: string) => {
    void CreateAppBackup(true, password)
      .then(() => window.alert("加密备份创建成功，请妥善保管密码"))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        window.alert(`备份失败: ${message}`);
      });
  };

  const handleRestoreBackup = () => {
    // Try to restore without password first (might be unencrypted)
    void RestoreAppBackup("")
      .then(() => window.alert("恢复成功"))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        // Check if it's an encryption-related error
        if (message.includes("encrypted") || message.includes("password")) {
          setShowRestorePasswordDialog(true);
        } else {
          window.alert(`恢复失败: ${message}`);
        }
      });
  };

  const handleRestoreWithPassword = (password: string) => {
    void RestoreAppBackup(password)
      .then(() => window.alert("恢复成功"))
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("decrypt") || message.includes("wrong password")) {
          window.alert("密码错误，请重试");
        } else {
          window.alert(`恢复失败: ${message}`);
        }
      });
  };

  const isDefaultAdvanced =
    advancedOptions.databaseDriver === DEFAULT_ADVANCED_OPTIONS.databaseDriver &&
    advancedOptions.logLevel === DEFAULT_ADVANCED_OPTIONS.logLevel;

  const handleExport = () => {
    if (!accounts.length) {
      window.alert?.("暂无可导出的账户");
      return;
    }
    void accountsStore
      .exportAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const lines = [
          `已导出 ${summary.count} 个账户`,
          summary.filePath ? `保存位置：${summary.filePath}` : null,
        ].filter(Boolean);
        window.alert?.(lines.join("\n"));
      })
      .catch(() => {
        /* handled */
      });
  };

  const handleOpenIssues = () => openExternalLink(ISSUES_URL);

  const handleImport = () => {
    void accountsStore
      .importAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const lines = [
          `成功导入 ${summary.imported}/${summary.total} 个账户`,
          summary.skipped ? `跳过 ${summary.skipped} 个` : null,
          summary.failed ? `失败 ${summary.failed} 个` : null,
        ].filter(Boolean);
        if (summary.issues?.length) {
          lines.push("详情：");
          summary.issues.forEach((issue) => lines.push(`- ${issue}`));
        }
        window.alert?.(lines.join("\n"));
      })
      .catch(() => {
        /* handled */
      });
  };

  const handleIdleTimeoutChange = (value: string) => {
    setIdleTimeout(Number(value));
  };

  const handleLockStrategyChange = (value: "lock" | "logout") => {
    setLockStrategy(value);
  };

  const handleClearOfflineCache = async () => {
    await offlineCache.clear();
    const usage = await offlineCache.getUsage();
    setCacheUsage(usage);
    window.alert?.("缓存已清除");
  };

  const handleCacheSizeChange = (value: string) => {
    const numeric = Number(value) as CacheSize;
    setOfflineCacheSize(numeric);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const idleTimeoutLabel = idleTimeoutMinutes === 0 ? "从不" : `${idleTimeoutMinutes} 分钟`;

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="系统设置"
        description="管理应用偏好、主题外观以及数据导入导出。"
        showBack
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>外观</CardTitle>
            <CardDescription>
              自定义界面显示模式。
              <span className="ml-1 inline-block">
                (当前:{" "}
                {themePreference === "system"
                  ? `跟随系统 · ${resolvedTheme === "dark" ? "深色" : "浅色"}`
                  : resolvedTheme === "dark"
                    ? "深色"
                    : "浅色"}
                )
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                className={`group cursor-pointer rounded-xl border-2 p-1 transition-all ${
                  themePreference === "light"
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent"
                }`}
                onClick={() => handleThemeSelection("light")}
              >
                <div className="flex h-[100px] w-full flex-col justify-between rounded-lg bg-[#ecedef] p-2 transition-transform group-hover:scale-[1.02]">
                  <div className="space-y-2 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-2 w-[80px] rounded-lg bg-[#ecedef]" />
                    <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-white p-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full bg-[#ecedef]" />
                    <div className="h-2 w-[100px] rounded-lg bg-[#ecedef]" />
                  </div>
                </div>
                <div className="mt-2 text-center text-sm font-medium">浅色</div>
              </button>

              <button
                type="button"
                className={`group cursor-pointer rounded-xl border-2 p-1 transition-all ${
                  themePreference === "dark"
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent"
                }`}
                onClick={() => handleThemeSelection("dark")}
              >
                <div className="flex h-[100px] w-full flex-col justify-between rounded-lg bg-slate-950 p-2 transition-transform group-hover:scale-[1.02]">
                  <div className="space-y-2 rounded-md bg-slate-800 p-2 shadow-sm">
                    <div className="h-2 w-[80px] rounded-lg bg-slate-500" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-500" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-slate-800 p-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full bg-slate-500" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-500" />
                  </div>
                </div>
                <div className="mt-2 text-center text-sm font-medium">深色</div>
              </button>

              <button
                type="button"
                className={`group cursor-pointer rounded-xl border-2 p-1 transition-all ${
                  themePreference === "system"
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-transparent"
                }`}
                onClick={() => handleThemeSelection("system")}
              >
                <div className="relative flex h-[100px] w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#ecedef] via-slate-200 to-slate-900 transition-transform group-hover:scale-[1.02]">
                  {/* Split Background effect */}
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 bg-[#ecedef] p-2">
                      <div className="mt-4 h-2 w-12 rounded-full bg-white opacity-60" />
                    </div>
                    <div className="w-1/2 bg-slate-950 p-2">
                      <div className="ml-auto mt-4 h-2 w-12 rounded-full bg-slate-800 opacity-60" />
                    </div>
                  </div>
                  <div className="relative z-10 rounded-md bg-background/80 px-2 py-1 text-xs font-bold shadow-sm backdrop-blur-sm">
                    Auto
                  </div>
                </div>
                <div className="mt-2 text-center text-sm font-medium">系统</div>
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>数据管理</CardTitle>
            <CardDescription>在不同设备间同步或备份你的账户配置。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row">
            <Button variant="outline" onClick={handleImport} className="w-full sm:w-auto">
              导入账户
            </Button>
            <Button onClick={handleExport} disabled={!accounts.length} className="w-full sm:w-auto">
              导出账户 ({accounts.length})
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>系统备份</CardTitle>
            <CardDescription>创建包含应用设置、账户配置和偏好设置的完整备份。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="backup-encryption"
                checked={enableBackupEncryption}
                onCheckedChange={setEnableBackupEncryption}
              />
              <Label htmlFor="backup-encryption" className="cursor-pointer">
                启用备份加密 (AES-256-GCM)
              </Label>
            </div>
            {enableBackupEncryption && (
              <p className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3">
                启用加密后，备份文件将使用密码保护。请务必牢记密码，丢失密码将无法恢复数据。
              </p>
            )}
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button variant="outline" onClick={handleRestoreBackup} className="w-full sm:w-auto">
                从文件恢复
              </Button>
              <Button onClick={handleCreateBackup} className="w-full sm:w-auto">
                创建完整备份
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>高级设置</CardTitle>
            <CardDescription>调整底层行为和日志级别。这些设置仅对当前设备生效。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="driver-select">数据库驱动</Label>
                <Select
                  value={advancedOptions.databaseDriver}
                  onValueChange={(val) =>
                    updateAdvancedOptions({
                      databaseDriver: val as DatabaseDriver,
                    })
                  }
                >
                  <SelectTrigger id="driver-select">
                    <SelectValue placeholder="选择驱动" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sqlite">SQLite (持久化)</SelectItem>
                    <SelectItem value="memory">Memory (临时会话)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[0.8rem] text-muted-foreground">
                  Memory 模式下数据将在重启后丢失。
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="log-select">日志级别</Label>
                <Select
                  value={advancedOptions.logLevel}
                  onValueChange={(val) => updateAdvancedOptions({ logLevel: val as LogLevel })}
                >
                  <SelectTrigger id="log-select">
                    <SelectValue placeholder="选择级别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[0.8rem] text-muted-foreground">
                  通常无需更改，Debug 模式会产生大量日志。
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-destructive"
                onClick={handleResetAdvanced}
                disabled={isDefaultAdvanced}
              >
                恢复默认设置
              </Button>
            </div>
          </CardContent>
        </Card>

        <TransferSettingsCard />

        <Card>
          <CardHeader>
            <CardTitle>离线缓存 / Offline Cache</CardTitle>
            <CardDescription>
              管理离线数据缓存。开启后，将缓存最近浏览的列表和文件，以便在无网络时访问。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>启用离线缓存</Label>
                <p className="text-xs text-muted-foreground">
                  自动缓存浏览过的存储桶列表和对象列表
                </p>
              </div>
              <Switch checked={offlineCacheEnabled} onCheckedChange={setOfflineCacheEnabled} />
            </div>
            {offlineCacheEnabled && (
              <div className="space-y-4">
                <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <Label>缓存大小</Label>
                    <p className="text-xs text-muted-foreground">限制离线缓存的最大占用</p>
                  </div>
                  <Select value={String(offlineCacheSize)} onValueChange={handleCacheSizeChange}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 MB</SelectItem>
                      <SelectItem value="50">50 MB</SelectItem>
                      <SelectItem value="100">100 MB</SelectItem>
                      <SelectItem value="500">500 MB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">当前占用</p>
                      <p className="text-2xl font-bold">
                        {cacheUsage ? formatBytes(cacheUsage.usage) : "Calculating..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        (Quota: {cacheUsage ? formatBytes(cacheUsage.quota) : "-"})
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleClearOfflineCache}>
                      清除缓存
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>会话安全</CardTitle>
            <CardDescription>
              配置空闲锁屏/自动注销策略，保护控制台无人值守时的安全。
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="idle-timeout">空闲时长</Label>
              <Select value={String(idleTimeoutMinutes)} onValueChange={handleIdleTimeoutChange}>
                <SelectTrigger id="idle-timeout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 分钟</SelectItem>
                  <SelectItem value="60">1 小时</SelectItem>
                  <SelectItem value="0">从不</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                当前策略：{idleTimeoutLabel} 无操作后触发。
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lock-strategy">触发后操作</Label>
              <Select value={lockStrategy} onValueChange={handleLockStrategyChange}>
                <SelectTrigger id="lock-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lock">锁屏，手动解锁后继续</SelectItem>
                  <SelectItem value="logout">自动注销并刷新应用</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                推荐选择“锁屏”，只有在高敏环境下才使用“自动注销”。
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>版本更新 / Updates</CardTitle>
            <CardDescription>当前版本：{APP_VERSION}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {updateInfo ? (
              updateInfo.updateAvailable ? (
                <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  发现新版本 {updateInfo.latestVersion || "未知版本"}，点击“查看发布页”获取安装包。
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
            {updateError ? <p className="text-sm text-destructive">{updateError}</p> : null}
            {updateInfo?.releaseNotes ? (
              <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  最新发布说明 / Release Notes
                </p>
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-sm">
                  {updateInfo.releaseNotes}
                </p>
              </div>
            ) : null}
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
          </CardContent>
        </Card>

        <PerformanceCard />

        <Card>
          <CardHeader>
            <CardTitle>关于</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
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
          </CardContent>
        </Card>
      </div>

      <PasswordDialog
        open={showBackupPasswordDialog}
        onOpenChange={setShowBackupPasswordDialog}
        title="设置备份密码"
        description="请输入一个强密码来加密备份文件。请牢记此密码，丢失后将无法恢复。"
        onConfirm={handleCreateEncryptedBackup}
        confirmText="创建加密备份"
        requireConfirmation={true}
      />

      <PasswordDialog
        open={showRestorePasswordDialog}
        onOpenChange={setShowRestorePasswordDialog}
        title="输入备份密码"
        description="此备份文件已加密，请输入创建时设置的密码。"
        onConfirm={handleRestoreWithPassword}
        confirmText="恢复"
        requireConfirmation={false}
      />
    </div>
  );
}
