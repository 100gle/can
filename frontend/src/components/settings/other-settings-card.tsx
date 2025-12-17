import { UpdateChecker } from "@/components/settings/update-checker";
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
import { useAccounts } from "@/hooks/useAccounts";
import { showError, showSuccess } from "@/lib/toast";
import { usePreferencesStore, type LogLevel } from "@/state/preferences";
import {
  ExportLogs,
  GetLogDirectory,
  OpenLogDirectory,
  SaveFileDialog,
  SetLogLevel,
} from "@wailsjs/go/app/App";
import { FolderOpen, Package } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsItem } from "./settings-item";
import { SettingsSection } from "./settings-section";

const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";
const ISSUES_URL = "https://github.com/100gle/can/issues/new/choose";

const openExternalLink = (url: string) => {
  window.open(url, "_blank", "noreferrer");
};

export function OtherSettingsCard() {
  const { t } = useTranslation();
  const { accounts } = useAccounts();

  // Logging settings
  const logLevel = usePreferencesStore((state) => state.logLevel);
  const setLogLevel = usePreferencesStore((state) => state.setLogLevel);
  const resetAllSettings = usePreferencesStore((state) => state.resetAllSettings);

  // Logging state
  const [logDir, setLogDir] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    GetLogDirectory().then((dir) => {
      if (dir) setLogDir(dir);
    });
  }, []);

  const handleLogLevelChange = async (val: LogLevel) => {
    setLogLevel(val);
    try {
      await SetLogLevel(val);
    } catch {
      // Silent fail - local preference is already updated
    }
  };

  const handleOpenLogDir = async () => {
    try {
      await OpenLogDirectory();
    } catch {
      showError(t("settings.logging.error.openDir"));
    }
  };

  const handleExportLogs = async () => {
    // Generate default filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const defaultFilename = `can_logs_${timestamp}.zip`;

    // Use Wails save dialog
    const targetPath = await SaveFileDialog(
      t("settings.logging.exportDialogTitle"),
      defaultFilename,
      [{ displayName: "ZIP Archive", pattern: "*.zip" }],
    );

    if (!targetPath) {
      // User cancelled
      return;
    }

    setIsExporting(true);
    try {
      const zipPath = await ExportLogs(targetPath);
      showSuccess(t("settings.logging.exportSuccess", { path: zipPath }));
    } catch {
      showError(t("settings.logging.error.export"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleResetAllSettings = useCallback(() => {
    resetAllSettings();
  }, [resetAllSettings]);

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

      {/* Logging - combined log level, directory, and operations */}
      <SettingsItem
        label={t("settings.logging.title")}
        description={
          logDir ? `${t("settings.logging.directory")}: ${logDir}` : t("settings.advanced.logWarn")
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select value={logLevel} onValueChange={(val) => handleLogLevelChange(val as LogLevel)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder={t("settings.advanced.selectLevel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleOpenLogDir}>
            <FolderOpen className="mr-2 h-4 w-4" />
            {t("settings.logging.openDir")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportLogs} disabled={isExporting}>
            <Package className="mr-2 h-4 w-4" />
            {isExporting ? t("settings.logging.exporting") : t("settings.logging.export")}
          </Button>
        </div>
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
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleResetAllSettings}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("common.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsItem>

      {/* Check Updates */}
      <UpdateChecker appVersion={APP_VERSION} onOpenExternalLink={openExternalLink} />
    </SettingsSection>
  );
}
