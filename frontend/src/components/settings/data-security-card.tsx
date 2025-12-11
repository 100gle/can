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

interface DataSecurityCardProps {
  onRequestEncryptedBackup: () => void;
  onRequestRestoreWithPassword: () => void;
}

export function DataSecurityCard({
  onRequestEncryptedBackup,
  onRequestRestoreWithPassword,
}: DataSecurityCardProps) {
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
      showError("暂无可导出的账户");
      return;
    }
    void accountsStore
      .exportAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const message = [
          `已导出 ${summary.count} 个账户`,
          summary.filePath ? `保存位置：${summary.filePath}` : null,
        ]
          .filter(Boolean)
          .join("\n");
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
        const message = [
          `成功导入 ${summary.imported}/${summary.total} 个账户`,
          summary.skipped ? `跳过 ${summary.skipped} 个` : null,
          summary.failed ? `失败 ${summary.failed} 个` : null,
        ].filter(Boolean);
        if (summary.issues?.length) {
          message.push("详情：");
          summary.issues.forEach((issue) => message.push(`- ${issue}`));
        }
        showSuccess(message.join("\n"));
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
    if (result.error.includes("encrypted") || result.error.includes("wrong password")) {
      onRequestRestoreWithPassword();
    } else {
      showError(`恢复失败: ${result.error}`);
    }
  };

  const handleIdleTimeoutChange = (value: string) => {
    setIdleTimeout(Number(value));
  };

  const handleLockStrategyChange = (value: "lock" | "logout") => {
    setLockStrategy(value);
  };

  const idleTimeoutLabel = idleTimeoutMinutes === 0 ? "从不" : `${idleTimeoutMinutes} 分钟`;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-lg font-semibold">数据安全</CardTitle>
          <CardDescription className="text-sm">账户导入导出、系统备份与会话安全</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Data Management Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">数据管理</h3>
            <p className="text-xs text-muted-foreground">在不同设备间同步或备份你的账户配置</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button variant="outline" onClick={handleImport} className="w-full sm:w-auto">
              导入账户
            </Button>
            <Button onClick={handleExport} disabled={!accounts.length} className="w-full sm:w-auto">
              导出账户 ({accounts.length})
            </Button>
          </div>
        </div>

        <Separator />

        {/* System Backup Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">系统备份</h3>
            <p className="text-xs text-muted-foreground">
              创建包含应用设置、账户配置和偏好设置的完整备份
            </p>
          </div>
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
        </div>

        <Separator />

        {/* Session Security Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">会话安全</h3>
            <p className="text-xs text-muted-foreground">
              配置空闲锁屏/自动注销策略，保护控制台无人值守时的安全
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="idle-timeout">空闲时长</Label>
              <Select value={String(idleTimeoutMinutes)} onValueChange={handleIdleTimeoutChange}>
                <SelectTrigger id="idle-timeout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 分钟</SelectItem>
                  <SelectItem value="60">1 小时</SelectItem>
                  <SelectItem value="0">从不</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                当前策略：{idleTimeoutLabel} 无操作后触发。
              </p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="lock-strategy">触发后操作</Label>
              <Select value={lockStrategy} onValueChange={handleLockStrategyChange}>
                <SelectTrigger id="lock-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lock">锁屏，手动解锁后继续</SelectItem>
                  <SelectItem value="logout">自动注销并刷新应用</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                推荐选择"锁屏"，只有在高敏环境下才使用"自动注销"。
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
