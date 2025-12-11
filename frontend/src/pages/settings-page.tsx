import { PasswordDialog } from "@/components/dialogs/password-dialog";
import { PageHeader } from "@/components/layouts/page-header";
import { AdvancedSettingsCard } from "@/components/settings/advanced-settings-card";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { DataSecurityCard } from "@/components/settings/data-security-card";
import { SystemInformationCard } from "@/components/settings/system-information-card";
import { TransferCacheCard } from "@/components/settings/transfer-cache-card";
import { backupService } from "@/lib/services";
import { showError, showSuccess } from "@/lib/toast";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function SettingsPage() {
  const { t } = useTranslation();
  const [showBackupPasswordDialog, setShowBackupPasswordDialog] = useState(false);
  const [showRestorePasswordDialog, setShowRestorePasswordDialog] = useState(false);

  const handleCreateEncryptedBackup = async (password: string) => {
    const result = await backupService.createEncryptedBackup(password);
    if (!result.success) {
      showError(t("settingsPage.backup.error", { error: result.error }));
    }
  };

  const handleRestoreWithPassword = async (password: string) => {
    const result = await backupService.restoreBackup(password);
    if (result.success) {
      showSuccess(t("settingsPage.backup.restoreSuccess"));
    } else {
      if (result.error.includes("decrypt") || result.error.includes("wrong password")) {
        showError(t("settingsPage.backup.passwordError"));
      } else {
        showError(t("settingsPage.backup.restoreFailed", { error: result.error }));
      }
    }
  };

  return (
    <div className="p-6 space-y-8 bg-muted/30 min-h-screen">
      <PageHeader
        title={t("settingsPage.header.title")}
        description={t("settingsPage.header.description")}
        showBack
      />

      <div className="space-y-6">
        <AppearanceCard />
        <AdvancedSettingsCard />
        <DataSecurityCard
          onRequestEncryptedBackup={() => setShowBackupPasswordDialog(true)}
          onRequestRestoreWithPassword={() => setShowRestorePasswordDialog(true)}
        />
        <TransferCacheCard />
        <SystemInformationCard />
      </div>

      <PasswordDialog
        open={showBackupPasswordDialog}
        onOpenChange={setShowBackupPasswordDialog}
        title={t("settingsPage.backup.createTitle")}
        description={t("settingsPage.backup.createDesc")}
        onConfirm={handleCreateEncryptedBackup}
        confirmText={t("settingsPage.backup.createConfirm")}
        requireConfirmation={true}
      />

      <PasswordDialog
        open={showRestorePasswordDialog}
        onOpenChange={setShowRestorePasswordDialog}
        title={t("settingsPage.backup.restoreTitle")}
        description={t("settingsPage.backup.restoreDesc")}
        onConfirm={handleRestoreWithPassword}
        confirmText={t("settingsPage.backup.restoreConfirm")}
        requireConfirmation={false}
      />
    </div>
  );
}
