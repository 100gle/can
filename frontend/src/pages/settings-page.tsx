import { PasswordDialog } from "@/components/dialogs/password-dialog";
import { PageHeader } from "@/components/layouts/page-header";
import { DataSecurityCard } from "@/components/settings/data-security-card";
import { GeneralSettingsCard } from "@/components/settings/general-settings-card";
import { SystemInformationCard } from "@/components/settings/system-information-card";
import { TransferCacheCard } from "@/components/settings/transfer-cache-card";
import { backupService } from "@/lib/services";
import { showError, showSuccess } from "@/lib/toast";
import { useState } from "react";

export default function SettingsPage() {
  const [showBackupPasswordDialog, setShowBackupPasswordDialog] = useState(false);
  const [showRestorePasswordDialog, setShowRestorePasswordDialog] = useState(false);

  const handleCreateEncryptedBackup = async (password: string) => {
    const result = await backupService.createEncryptedBackup(password);
    if (!result.success) {
      showError(`备份失败: ${result.error}`);
    }
  };

  const handleRestoreWithPassword = async (password: string) => {
    const result = await backupService.restoreBackup(password);
    if (result.success) {
      showSuccess("恢复成功");
    } else {
      if (result.error.includes("decrypt") || result.error.includes("wrong password")) {
        showError("密码错误，请重试");
      } else {
        showError(`恢复失败: ${result.error}`);
      }
    }
  };

  return (
    <div className="p-6 space-y-8 bg-muted/30 min-h-screen">
      <PageHeader
        title="系统设置"
        description="浏览、调整应用偏好设置（如主题外观、数据安全等）"
        showBack
      />

      <div className="space-y-6">
        <GeneralSettingsCard />
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
        title="设置备份密码"
        description="请输入一个强密码来加密备份文件。请牢记此密码，丢失后将无法恢复。"
        onConfirm={handleCreateEncryptedBackup}
        confirmText="创建加密备份"
        requireConfirmation={true}
      />

      <PasswordDialog
        open={showRestorePasswordDialog}
        onOpenChange={setShowRestorePasswordDialog}
        title="输入备份密码"
        description="此备份文件已加密，请输入创建时设置的密码。"
        onConfirm={handleRestoreWithPassword}
        confirmText="恢复"
        requireConfirmation={false}
      />
    </div>
  );
}
