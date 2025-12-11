import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { backupService } from "@/lib/services";
import { showError } from "@/lib/toast";
import { usePreferencesStore } from "@/state/preferences";
import { useTranslation } from "react-i18next";

interface BackupCardProps {
  onRequestEncryptedBackup: () => void;
  onRequestRestoreWithPassword: () => void;
}

export function BackupCard({
  onRequestEncryptedBackup,
  onRequestRestoreWithPassword,
}: BackupCardProps) {
  const { t } = useTranslation();
  const backupEncryptionEnabled = usePreferencesStore((state) => state.backupEncryptionEnabled);
  const setBackupEncryptionEnabled = usePreferencesStore(
    (state) => state.setBackupEncryptionEnabled,
  );

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
    if (result.error.includes("encrypted") || result.error.includes("password")) {
      onRequestRestoreWithPassword();
    } else {
      showError(`Restore failed: ${result.error}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>{t("settings.backup.title")}</CardTitle>
          <CardDescription className="text-xs">{t("settings.backup.subtitle")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
