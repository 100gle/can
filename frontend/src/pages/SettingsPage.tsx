import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { useBackNavigation } from "@/hooks/useBackNavigation";
import { useResolvedTheme } from "@/components/providers/ThemeProvider";
import {
  DEFAULT_ADVANCED_OPTIONS,
  usePreferencesStore,
  type AdvancedOptions,
  type DatabaseDriver,
  type LogLevel,
  type ThemePreference,
} from "@/state/preferences";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const DOCS_BASE_URL = "https://github.com/100gle/can/blob/main/docs";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";

const openExternalLink = (url: string) => {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noreferrer");
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const accounts = useAccountsStore((state) => state.accounts);
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const themePreference = usePreferencesStore((state) => state.themePreference);
  const setThemePreference = usePreferencesStore((state) => state.setThemePreference);
  const advancedOptions = usePreferencesStore((state) => state.advancedOptions);
  const setAdvancedOptions = usePreferencesStore((state) => state.setAdvancedOptions);
  const resetAdvancedOptions = usePreferencesStore((state) => state.resetAdvancedOptions);
  const resolvedTheme = useResolvedTheme();
  const handleBack = useBackNavigation(() => {
    if (activeAccountId) {
      navigate({ to: "/accounts/$accountId/dashboard", params: { accountId: activeAccountId } });
      return;
    }
    navigate({ to: "/" });
  });

  const handleThemeSelection = (value: ThemePreference) => {
    setThemePreference(value);
  };

  const updateAdvancedOptions = (patch: Partial<AdvancedOptions>) => {
    setAdvancedOptions(patch);
  };

  const handleResetAdvanced = () => {
    resetAdvancedOptions();
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

  const openDocs = (filename: string) => openExternalLink(`${DOCS_BASE_URL}/${filename}`);
  const handleOpenRedesignPlan = () => openDocs("FRONTEND_REDESIGN_PLAN.md");
  const handleOpenChecklist = () => openDocs("IMPLEMENTATION_CHECKLIST.md");
  const handleOpenQuickReference = () => openDocs("FRONTEND_QUICK_REFERENCE.md");
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/40 bg-card/60 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Button variant="ghost" size="sm" className="gap-2" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            返回
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate({ to: "/" })}>
              <Home className="h-4 w-4" />
              账户中心
            </Button>
          </div>
        </div>
      </div>
      <div className="px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <header>
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
              System Settings
            </p>
            <h1 className="mt-2 text-3xl font-semibold">CAN 控制中心</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              管理主题、导入导出账户配置，并查看版本信息。更多功能正在按照 FRONTEND_REDESIGN_PLAN.md
              实施。
            </p>
          </header>

          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">主题外观</h2>
                <p className="text-sm text-muted-foreground">
                  在浅色、深色或跟随系统之间切换，偏好保存在本地存储并会在下次启动时自动恢复。
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  当前模式：
                  {themePreference === "system"
                    ? `系统 · ${resolvedTheme === "dark" ? "深色" : "浅色"}`
                    : resolvedTheme === "dark"
                      ? "深色"
                      : "浅色"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={themePreference === "light" ? "default" : "outline"}
                  onClick={() => handleThemeSelection("light")}
                >
                  浅色
                </Button>
                <Button
                  variant={themePreference === "dark" ? "default" : "outline"}
                  onClick={() => handleThemeSelection("dark")}
                >
                  深色
                </Button>
                <Button
                  variant={themePreference === "system" ? "default" : "outline"}
                  onClick={() => handleThemeSelection("system")}
                >
                  跟随系统
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">导入 / 导出</h2>
                <p className="text-sm text-muted-foreground">
                  通过桌面文件对话框在多台设备之间同步账户配置。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleImport}>
                  导入配置
                </Button>
                <Button onClick={handleExport} disabled={!accounts.length}>
                  导出配置
                </Button>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">高级选项</h2>
              <p className="text-sm text-muted-foreground">
                实验性设置仅保存在本地设备上，适合在演示或调试阶段快速切换行为。
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-foreground">数据库驱动</label>
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  value={advancedOptions.databaseDriver}
                  onChange={(event) =>
                    updateAdvancedOptions({
                      databaseDriver: event.target.value as DatabaseDriver,
                    })
                  }
                >
                  <option value="sqlite">SQLite（持久化）</option>
                  <option value="memory">Memory（临时会话）</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Memory 模式不会写入本地数据库，重启客户端后配置会丢失。
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">日志级别</label>
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  value={advancedOptions.logLevel}
                  onChange={(event) =>
                    updateAdvancedOptions({ logLevel: event.target.value as LogLevel })
                  }
                >
                  <option value="debug">Debug（最详细）</option>
                  <option value="info">Info（默认）</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Debug 适合排查问题，生产环境建议使用 Info 或更高等级。
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleResetAdvanced} disabled={isDefaultAdvanced}>
                恢复默认
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-semibold">关于应用</h2>
            <dl className="mt-3 space-y-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <dt>版本号</dt>
                <dd className="font-medium text-foreground">{APP_VERSION}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>账户数量</dt>
                <dd>{accounts.length}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">文档</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={handleOpenRedesignPlan}>
                    重构计划
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleOpenChecklist}>
                    实现清单
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleOpenQuickReference}>
                    速查表
                  </Button>
                </dd>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <dt className="font-medium text-foreground">反馈渠道</dt>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    在 GitHub Issues 中报告问题或分享新的需求。
                  </dd>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenIssues}>
                  打开 Issues
                </Button>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
