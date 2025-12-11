import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckForUpdates } from "@wailsjs/go/app/App";
import { system } from "@wailsjs/go/models";
import { ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noreferrer");
};

export function UpdatesCard() {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<system.UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>{t("system.update.title")}</CardTitle>
          <CardDescription className="text-xs">
            {t("system.update.currentVersion", { version: APP_VERSION })}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
      </CardContent>
    </Card>
  );
}
