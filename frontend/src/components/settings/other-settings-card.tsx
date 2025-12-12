import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/lib/utils";
import { useAccountsStore } from "@/state/accounts";
import {
  usePreferencesStore,
  type AdvancedOptions,
  type DatabaseDriver,
  type LogLevel,
} from "@/state/preferences";
import { CheckForUpdates, GetSystemMetrics } from "@wailsjs/go/app/App";
import { system } from "@wailsjs/go/models";
import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsItem } from "./settings-item";
import { SettingsSection } from "./settings-section";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";
const UPDATE_CHECK_TIMEOUT = 15000; // 15 seconds

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noreferrer");
};

export function OtherSettingsCard() {
  const { t } = useTranslation();
  const accounts = useAccountsStore((state) => state.accounts);
  const [metrics, setMetrics] = useState<system.SystemMetrics | null>(null);
  const [updateInfo, setUpdateInfo] = useState<system.UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateTimeoutRef = useRef<number | null>(null);

  // Advanced settings
  const advancedOptions = usePreferencesStore((state) => state.advancedOptions);
  const setAdvancedOptions = usePreferencesStore((state) => state.setAdvancedOptions);
  const resetAllSettings = usePreferencesStore((state) => state.resetAllSettings);

  const updateAdvancedOptions = (patch: Partial<AdvancedOptions>) => {
    setAdvancedOptions(patch);
  };

  const handleResetAllSettings = useCallback(() => {
    resetAllSettings();
  }, [resetAllSettings]);

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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  const handleCheckUpdates = () => {
    setCheckingUpdate(true);
    setUpdateError(null);

    // Set timeout to prevent infinite loading
    updateTimeoutRef.current = window.setTimeout(() => {
      setCheckingUpdate(false);
      setUpdateError(t("system.update.timeout"));
    }, UPDATE_CHECK_TIMEOUT);

    void CheckForUpdates(APP_VERSION)
      .then((info) => {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
        }
        setUpdateInfo(info);
        setCheckingUpdate(false);
      })
      .catch((error) => {
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = null;
        }
        const message = error instanceof Error ? error.message : t("system.update.checkFailed");
        setUpdateError(message);
        setCheckingUpdate(false);
      });
  };

  const handleOpenIssues = () => openExternalLink(ISSUES_URL);

  return (
    <SettingsSection title={t("system.title")} description={t("system.titleDesc")}>
      {/* Version */}
      <SettingsItem label={t("system.about.version")}>
        <span className="text-sm font-medium">{APP_VERSION}</span>
      </SettingsItem>

      {/* Connected Accounts */}
      <SettingsItem label={t("system.about.accounts")}>
        <span className="text-sm font-medium">{accounts.length}</span>
      </SettingsItem>

      {/* Feedback */}
      <SettingsItem label={t("system.about.feedback")}>
        <Button variant="outline" size="sm" onClick={handleOpenIssues}>
          {t("system.about.submitFeedback")}
        </Button>
      </SettingsItem>

      {/* Database Driver */}
      <SettingsItem
        label={t("settings.advanced.driver")}
        description={t("settings.advanced.driverWarn")}
      >
        <Select
          value={advancedOptions.databaseDriver}
          onValueChange={(val) => updateAdvancedOptions({ databaseDriver: val as DatabaseDriver })}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t("settings.advanced.selectDriver")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sqlite">{t("settings.advanced.driverSqlite")}</SelectItem>
            <SelectItem value="memory">{t("settings.advanced.driverMemory")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsItem>

      {/* Log Level */}
      <SettingsItem
        label={t("settings.advanced.logLevel")}
        description={t("settings.advanced.logWarn")}
      >
        <Select
          value={advancedOptions.logLevel}
          onValueChange={(val) => updateAdvancedOptions({ logLevel: val as LogLevel })}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t("settings.advanced.selectLevel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="debug">Debug</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warn</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </SettingsItem>

      {/* Reset All Settings with Confirmation */}
      <SettingsItem
        label={t("settings.advanced.title")}
        description={t("settings.advanced.resetAllDesc")}
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              {t("settings.advanced.resetAll")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.advanced.resetConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("settings.advanced.resetAllConfirmDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleResetAllSettings}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsItem>

      {/* Check Updates */}
      <SettingsItem
        label={t("system.update.title")}
        description={
          updateInfo
            ? updateInfo.updateAvailable
              ? t("system.update.available", { version: updateInfo.latestVersion })
              : t("system.update.latest")
            : updateError || t("system.update.notChecked")
        }
      >
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckUpdates}
            disabled={checkingUpdate}
          >
            {checkingUpdate && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {t("system.update.button.check")}
          </Button>
          {updateInfo?.updateAvailable && updateInfo.releaseURL && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openExternalLink(updateInfo.releaseURL)}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              {t("system.update.button.release")}
            </Button>
          )}
        </div>
      </SettingsItem>

      {/* Performance Metrics - Full Width */}
      <SettingsItem
        label={t("system.metrics.title")}
        description={t("system.metrics.subtitle")}
        fullWidth
        showSeparator={false}
      >
        {metrics ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("system.metrics.memoryAlloc")}</p>
              <p className="text-lg font-bold">{formatBytes(metrics.memoryAlloc)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("system.metrics.memorySys")}</p>
              <p className="text-lg font-bold">{formatBytes(metrics.memorySys)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Goroutines</p>
              <p className="text-lg font-bold">{metrics.numGoroutines}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("system.metrics.activeTransfers")}</p>
              <p className="text-lg font-bold">{metrics.activeTransfers}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("system.metrics.loading")}</p>
        )}
      </SettingsItem>
    </SettingsSection>
  );
}
