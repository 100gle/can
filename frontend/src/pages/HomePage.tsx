import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { HomeLayout } from "@/components/layouts/HomeLayout";
import { AccountSelector } from "@/components/accounts/AccountSelector";
import { accountsStore, useAccountsStore } from "@/state/accounts";

export default function HomePage() {
  const navigate = useNavigate();
  const redirectRef = useRef(false);
  const accounts = useAccountsStore((state) => state.accounts);
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const loading = useAccountsStore((state) => state.loading);

  useEffect(() => {
    void accountsStore.bootstrap();
  }, []);

  useEffect(() => {
    if (redirectRef.current || loading) return;
    if (accounts.length === 1 && activeAccountId === accounts[0].id) {
      redirectRef.current = true;
      navigate({
        to: "/accounts/$accountId/dashboard",
        params: { accountId: accounts[0].id },
      });
    }
  }, [accounts, activeAccountId, loading, navigate]);

  const handleExportAccounts = () => {
    if (!accounts.length) {
      window.alert?.("暂无可导出的账户");
      return;
    }
    void accountsStore
      .exportAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const lines = [
          `已导出 ${summary.count} 个账户`,
          summary.filePath ? `保存位置：${summary.filePath}` : null,
        ].filter(Boolean);
        window.alert?.(lines.join("\n"));
      })
      .catch(() => {
        /* handled in store */
      });
  };

  const handleImportAccounts = () => {
    void accountsStore
      .importAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const lines = [
          `成功导入 ${summary.imported}/${summary.total} 个账户`,
          summary.skipped ? `跳过 ${summary.skipped} 个` : null,
          summary.failed ? `失败 ${summary.failed} 个` : null,
        ].filter(Boolean);
        if (summary.issues?.length) {
          lines.push("详情：");
          summary.issues.forEach((issue) => lines.push(`- ${issue}`));
        }
        window.alert?.(lines.join("\n"));
      })
      .catch(() => {
        /* handled */
      });
  };

  const handleOpenSettings = () => {
    navigate({ to: "/settings" });
  };

  return (
    <HomeLayout
      onImportAccounts={handleImportAccounts}
      onExportAccounts={handleExportAccounts}
      onOpenSettings={handleOpenSettings}
    >
      <AccountSelector />
    </HomeLayout>
  );
}
