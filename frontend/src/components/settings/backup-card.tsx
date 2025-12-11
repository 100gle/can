import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { backupService } from "@/lib/services";
import { showError } from "@/lib/toast";
import { usePreferencesStore } from "@/state/preferences";

interface BackupCardProps {
  onRequestEncryptedBackup: () => void;
  onRequestRestoreWithPassword: () => void;
}

export function BackupCard({
  onRequestEncryptedBackup,
  onRequestRestoreWithPassword,
}: BackupCardProps) {
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
        showError(`备份失败: ${result.error}`);
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
      showError(`恢复失败: ${result.error}`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>系统备份</CardTitle>
          <CardDescription className="text-xs">
            创建包含应用设置、账户配置和偏好设置的完整备份
          </CardDescription>
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
            启用备份加密 (AES-256-GCM)
          </Label>
        </div>
        {backupEncryptionEnabled && (
          <p className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3">
            启用加密后，备份文件将使用密码保护。请务必牢记密码，丢失密码将无法恢复数据。
          </p>
        )}
        <div className="flex flex-col gap-4 sm:flex-row">
          <Button variant="outline" onClick={handleRestoreBackup} className="w-full sm:w-auto">
            从文件恢复
          </Button>
          <Button onClick={handleCreateBackup} className="w-full sm:w-auto">
            创建完整备份
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
