import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { backupService } from "@/lib/services";
import { showError, showSuccess } from "@/lib/toast";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { usePreferencesStore } from "@/state/preferences";
import { useSessionStore } from "@/state/session";
import { useTranslation } from "react-i18next";

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
        // Use manual construction or simple formatting?
        // Let's use simple string concatenation or t with interpolation if structure permits.
        // But here we need newlines.
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
    // Try to restore - backupService will handle password prompt if needed
    const result = await backupService.restoreBackup("");
    if (result.success) {
      // Success is handled by backupService
      return;
    }
    // Check if encryption error
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
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-lg font-semibold">
            {t("settings.header.dataSecurity")}
          </CardTitle>
          <CardDescription className="text-sm">
            {t("settings.header.dataSecurityDesc")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Data Management Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">{t("settings.data.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("settings.data.desc")}</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button variant="outline" onClick={handleImport} className="w-full sm:w-auto">
              {t("settings.data.import")}
            </Button>
            <Button onClick={handleExport} disabled={!accounts.length} className="w-full sm:w-auto">
              {t("settings.data.export")} ({accounts.length})
            </Button>
          </div>
        </div>

        <Separator />

        {/* System Backup Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">{t("settings.backup.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("settings.backup.subtitle")}</p>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="backup-encryption"
              checked={backupEncryptionEnabled}
              onCheckedChange={setBackupEncryptionEnabled}
            />
            <Label htmlFor="backup-encryption" className="cursor-pointer">
              {t("settings.backup.enableEncryption")}
            </Label>
          </div>
          {backupEncryptionEnabled && (
            <p className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3">
              {t("settings.backup.encryptionWarning")}
            </p>
          )}
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button variant="outline" onClick={handleRestoreBackup} className="w-full sm:w-auto">
              {t("settings.backup.restore")}
            </Button>
            <Button onClick={handleCreateBackup} className="w-full sm:w-auto">
              {t("settings.backup.create")}
            </Button>
          </div>
        </div>

        <Separator />

        {/* Session Security Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">
              {t("settings.session.title")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("settings.session.desc")}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="idle-timeout">{t("settings.session.idleTimeout")}</Label>
              <Select value={String(idleTimeoutMinutes)} onValueChange={handleIdleTimeoutChange}>
                <SelectTrigger id="idle-timeout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">{t("settings.session.time.15min")}</SelectItem>
                  <SelectItem value="60">{t("settings.session.time.1hour")}</SelectItem>
                  <SelectItem value="0">{t("settings.session.never")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("settings.session.currentPolicy", { policy: displayIdleLabel })}
              </p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="lock-strategy">{t("settings.session.action")}</Label>
              <Select value={lockStrategy} onValueChange={handleLockStrategyChange}>
                <SelectTrigger id="lock-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lock">{t("settings.session.lock")}</SelectItem>
                  <SelectItem value="logout">{t("settings.session.logout")}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("settings.session.recommendation")}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
