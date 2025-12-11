import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatBytes } from "@/lib/utils";
import { useAccountsStore } from "@/state/accounts";
import { CheckForUpdates, GetSystemMetrics } from "@wailsjs/go/app/App";
import { system } from "@wailsjs/go/models";
import { ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noreferrer");
};

export function SystemInformationCard() {
  const { t } = useTranslation();
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
        const message = error instanceof Error ? error.message : t("system.update.checkFailed");
        setUpdateError(message);
      })
      .finally(() => setCheckingUpdate(false));
  };

  const handleOpenIssues = () => openExternalLink(ISSUES_URL);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-lg font-semibold">{t("system.title")}</CardTitle>
          <CardDescription className="text-sm">{t("system.titleDesc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* About Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">{t("system.about.title")}</h3>
          </div>
          <div className="grid gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("system.about.version")}</span>
              <span className="font-medium">{APP_VERSION}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("system.about.accounts")}</span>
              <span className="font-medium">{accounts.length}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-muted-foreground">{t("system.about.feedback")}</span>
              <Button variant="link" className="h-auto p-0" onClick={handleOpenIssues}>
                {t("system.about.submitFeedback")}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        {/* Updates Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">{t("system.update.title")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("system.update.currentVersion", { version: APP_VERSION })}
            </p>
          </div>
          <div className="space-y-3">
            {updateInfo ? (
              updateInfo.updateAvailable ? (
                <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                  {t("system.update.available", {
                    version: updateInfo.latestVersion || t("system.update.unknownVersion"),
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("system.update.latest")}</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground">{t("system.update.notChecked")}</p>
            )}
            {updateError && <p className="text-sm text-destructive">{updateError}</p>}
            {updateInfo?.releaseNotes && (
              <div className="rounded-lg border border-border/40 bg-muted/30 p-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {t("system.update.releaseNotes")}
                </p>
                <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-sm">
                  {updateInfo.releaseNotes}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleCheckUpdates} disabled={checkingUpdate} className="gap-2">
                {checkingUpdate && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("system.update.button.check")}
              </Button>
              {updateInfo?.updateAvailable && updateInfo.releaseURL ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => openExternalLink(updateInfo.releaseURL)}
                >
                  <ExternalLink className="h-4 w-4" />
                  {t("system.update.button.release")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <Separator />

        {/* Performance Monitoring Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">{t("system.metrics.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("system.metrics.subtitle")}</p>
          </div>
          {metrics ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("system.metrics.memoryAlloc")}
                </p>
                <p className="text-2xl font-bold">{formatBytes(metrics.memoryAlloc)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("system.metrics.memorySys")}
                </p>
                <p className="text-2xl font-bold">{formatBytes(metrics.memorySys)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("system.metrics.goroutines")}
                </p>
                <p className="text-2xl font-bold">{metrics.numGoroutines}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("system.metrics.activeTransfers")}
                </p>
                <p className="text-2xl font-bold">{metrics.activeTransfers}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("system.metrics.loading")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
