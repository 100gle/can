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
import { useAccountsStore } from "@/state/accounts";
import {
  usePreferencesStore,
  type AdvancedOptions,
  type DatabaseDriver,
  type LogLevel,
} from "@/state/preferences";
import { useCallback } from "react";
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
  const accounts = useAccountsStore((state) => state.accounts);

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
      <UpdateChecker appVersion={APP_VERSION} onOpenExternalLink={openExternalLink} />
    </SettingsSection>
  );
}
