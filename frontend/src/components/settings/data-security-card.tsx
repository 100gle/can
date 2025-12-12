import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { backupService } from "@/lib/services";
import { showError, showSuccess } from "@/lib/toast";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { usePreferencesStore } from "@/state/preferences";
import { useSessionStore } from "@/state/session";
import { useTranslation } from "react-i18next";
import { SettingsItem } from "./settings-item";
import { SettingsSection } from "./settings-section";

interface DataSecurityCardProps {
  onRequestEncryptedBackup: () => void;
  onRequestRestoreWithPassword: () => void;
}

export function DataSecurityCard({
  onRequestEncryptedBackup,
  onRequestRestoreWithPassword,
}: DataSecurityCardProps) {
  const { t } = useTranslation();
  const accounts = useAccountsStore((state) => state.accounts);
  const backupEncryptionEnabled = usePreferencesStore((state) => state.backupEncryptionEnabled);
  const setBackupEncryptionEnabled = usePreferencesStore(
    (state) => state.setBackupEncryptionEnabled,
  );
  const idleTimeoutMinutes = useSessionStore((state) => state.idleTimeoutMinutes);
  const lockStrategy = useSessionStore((state) => state.lockStrategy);
  const setIdleTimeout = useSessionStore((state) => state.setIdleTimeout);
  const setLockStrategy = useSessionStore((state) => state.setLockStrategy);

  const handleExport = () => {
    if (!accounts.length) {
      showError(t("settings.data.exportEmpty"));
      return;
    }
    void accountsStore
      .exportAccounts()
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
    void accountsStore
      .importAccounts()
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

  const handleCreateBackup = async () => {
    if (backupEncryptionEnabled) {
      onRequestEncryptedBackup();
    } else {
      const result = await backupService.createBackup();
      if (!result.success) {
        showError(`Backup failed: ${result.error}`);
      }
    }
  };

  const handleRestoreBackup = async () => {
    const result = await backupService.restoreBackup("");
    if (result.success) {
      return;
    }
    if (result.error.includes("encrypted") || result.error.includes("wrong password")) {
      onRequestRestoreWithPassword();
    } else {
      showError(`Restore failed: ${result.error}`);
    }
  };

  const handleIdleTimeoutChange = (value: string) => {
    setIdleTimeout(Number(value));
  };

  const handleLockStrategyChange = (value: "lock" | "logout") => {
    setLockStrategy(value);
  };

  const displayIdleLabel =
    idleTimeoutMinutes === 0
      ? t("settings.session.never")
      : idleTimeoutMinutes === 60
        ? t("settings.session.time.1hour")
        : t("settings.session.time.15min");

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

      {/* System Backup - Encryption */}
      <SettingsItem
        label={t("settings.backup.enableEncryption")}
        description={t("settings.backup.encryptionDesc")}
      >
        <Switch
          id="backup-encryption"
          checked={backupEncryptionEnabled}
          onCheckedChange={setBackupEncryptionEnabled}
        />
      </SettingsItem>

      {/* System Backup - Restore & Create */}
      <SettingsItem label={t("settings.backup.title")} description={t("settings.backup.subtitle")}>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRestoreBackup}>
            {t("settings.backup.restore")}
          </Button>
          <Button size="sm" onClick={handleCreateBackup}>
            {t("settings.backup.create")}
          </Button>
        </div>
      </SettingsItem>

      {/* Session Security - Idle Timeout */}
      <SettingsItem
        label={t("settings.session.idleTimeout")}
        description={t("settings.session.currentPolicy", { policy: displayIdleLabel })}
      >
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
      </SettingsItem>

      {/* Session Security - Lock Strategy */}
      <SettingsItem
        label={t("settings.session.action")}
        description={t("settings.session.recommendation")}
        showSeparator={false}
      >
        <Select value={lockStrategy} onValueChange={handleLockStrategyChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lock">{t("settings.session.lock")}</SelectItem>
            <SelectItem value="logout">{t("settings.session.logout")}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsItem>
    </SettingsSection>
  );
}
