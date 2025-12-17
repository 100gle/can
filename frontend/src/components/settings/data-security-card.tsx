import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePreferencesStore } from "@/state/preferences";

import { exportAccounts, importAccounts, useAccounts } from "@/hooks/useAccounts";
import { showError, showSuccess } from "@/lib/toast";
import { useTranslation } from "react-i18next";
import { SettingsItem } from "./settings-item";
import { SettingsSection } from "./settings-section";

export function DataSecurityCard() {
  const { t } = useTranslation();
  const { accounts } = useAccounts();

  const idleTimeoutMinutes = usePreferencesStore((state) => state.idleTimeoutMinutes);
  const lockStrategy = usePreferencesStore((state) => state.lockStrategy);
  const setIdleTimeout = usePreferencesStore((state) => state.setIdleTimeout);
  const setLockStrategy = usePreferencesStore((state) => state.setLockStrategy);

  const handleExport = () => {
    if (!accounts.length) {
      showError(t("settings.data.exportEmpty"));
      return;
    }
    void exportAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const message = t("settings.data.exportSuccess", {
          count: summary.count,
          path: summary.filePath || "",
        });
        showSuccess(message);
      })
      .catch(() => {
        /* handled */
      });
  };

  const handleImport = () => {
    void importAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        let message = t("settings.data.importSuccess", {
          imported: summary.imported,
          total: summary.total,
        });
        if (summary.skipped > 0 || summary.failed > 0) {
          message +=
            "\n" +
            t("settings.data.importSuccessDetails", {
              skipped: summary.skipped,
              failed: summary.failed,
            });
        }
        if (summary.issues?.length) {
          message += "\nDetails:";
          summary.issues.forEach((issue) => (message += `\n- ${issue}`));
        }
        showSuccess(message);
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

  return (
    <SettingsSection
      title={t("settings.header.dataSecurity")}
      description={t("settings.header.dataSecurityDesc")}
    >
      {/* Data Management - Import & Export */}
      <SettingsItem label={t("settings.data.title")} description={t("settings.data.desc")}>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            {t("settings.data.import")}
          </Button>
          <Button size="sm" onClick={handleExport} disabled={!accounts.length}>
            {t("settings.data.export")} ({accounts.length})
          </Button>
        </div>
      </SettingsItem>

      {/* Session Security */}
      <SettingsItem
        label={t("settings.session.title")}
        description={t("settings.session.desc")}
        showSeparator={false}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("settings.session.idleTimeout")}
            </span>
            <Select value={String(idleTimeoutMinutes)} onValueChange={handleIdleTimeoutChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">{t("settings.session.time.15min")}</SelectItem>
                <SelectItem value="60">{t("settings.session.time.1hour")}</SelectItem>
                <SelectItem value="0">{t("settings.session.never")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t("settings.session.action")}
            </span>
            <Select
              value={lockStrategy}
              onValueChange={handleLockStrategyChange}
              disabled={idleTimeoutMinutes === 0}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lock">{t("settings.session.lock")}</SelectItem>
                <SelectItem value="logout">{t("settings.session.logout")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SettingsItem>
    </SettingsSection>
  );
}
