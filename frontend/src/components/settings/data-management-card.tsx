import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { showError, showSuccess } from "@/lib/toast";
import { accountsStore, useAccountsStore } from "@/state/accounts";

export function DataManagementCard() {
  const accounts = useAccountsStore((state) => state.accounts);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>数据管理</CardTitle>
          <CardDescription className="text-xs">在不同设备间同步或备份你的账户配置</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row">
        <Button variant="outline" onClick={handleImport} className="w-full sm:w-auto">
          导入账户
        </Button>
        <Button onClick={handleExport} disabled={!accounts.length} className="w-full sm:w-auto">
          导出账户 ({accounts.length})
        </Button>
      </CardContent>
    </Card>
  );
}
