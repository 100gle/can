import { SettingsItem } from "@/components/settings/settings-item";
import { Button } from "@/components/ui/button";
import { CheckForUpdates } from "@wailsjs/go/app/App";
import { system } from "@wailsjs/go/models";
import { ExternalLink, Loader2 } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const UPDATE_CHECK_TIMEOUT = 15000; // 15 seconds

type UpdateCheckerProps = {
  appVersion: string;
  onOpenExternalLink: (url: string) => void;
};

export const UpdateChecker = memo(function UpdateChecker({
  appVersion,
  onOpenExternalLink,
}: UpdateCheckerProps) {
  const { t } = useTranslation();
  const [updateInfo, setUpdateInfo] = useState<system.UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const clearTimeoutIfNeeded = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }
  }, []);

  const handleCheckUpdates = useCallback(() => {
    setCheckingUpdate(true);
    setUpdateError(null);

    updateTimeoutRef.current = window.setTimeout(() => {
      setCheckingUpdate(false);
      setUpdateError(t("system.update.timeout"));
      updateTimeoutRef.current = null;
    }, UPDATE_CHECK_TIMEOUT);

    void CheckForUpdates(appVersion)
      .then((info) => {
        clearTimeoutIfNeeded();
        setUpdateInfo(info);
        setCheckingUpdate(false);
      })
      .catch((error) => {
        clearTimeoutIfNeeded();
        const message = error instanceof Error ? error.message : t("system.update.checkFailed");
        setUpdateError(message);
        setCheckingUpdate(false);
      });
  }, [appVersion, clearTimeoutIfNeeded, t]);

  return (
    <SettingsItem
      label={t("system.update.title")}
      description={
        updateInfo
          ? updateInfo.updateAvailable
            ? t("system.update.available", { version: updateInfo.latestVersion })
            : t("system.update.latest")
          : updateError || t("system.update.notChecked")
      }
      showSeparator={false}
    >
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCheckUpdates} disabled={checkingUpdate}>
          {checkingUpdate && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {t("system.update.button.check")}
        </Button>
        {updateInfo?.updateAvailable && updateInfo.releaseURL && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenExternalLink(updateInfo.releaseURL!)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            {t("system.update.button.release")}
          </Button>
        )}
      </div>
    </SettingsItem>
  );
});
