import { AccountSelector } from "@/components/accounts/account-selector";
import { HomeLayout } from "@/components/layouts/home-layout";
import { accountsStore, useAccountsStore, type AccountModel } from "@/state/accounts";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AccountFormDrawer } from "@/components/accounts/account-form-drawer";

type DrawerState =
  | { open: false }
  | {
      open: true;
      mode: "create" | "edit";
      account?: AccountModel;
    };

const CLOSED_DRAWER: DrawerState = { open: false };

export default function HomePage() {
  const navigate = useNavigate();
  const redirectRef = useRef(false);
  const accounts = useAccountsStore((state) => state.accounts);
  const providers = useAccountsStore((state) => state.providers);
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const loading = useAccountsStore((state) => state.loading);
  const [drawerState, setDrawerState] = useState<DrawerState>(CLOSED_DRAWER);

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

  const openDrawer = (mode: "create" | "edit", account?: AccountModel) => {
    setDrawerState({ open: true, mode, account });
  };

  const closeDrawer = () => setDrawerState(CLOSED_DRAWER);

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
      <AccountSelector
        onCreateAccount={() => openDrawer("create")}
        onEditAccount={(account) => openDrawer("edit", account)}
      />
      {drawerState.open ? (
        <AccountFormDrawer
          open
          mode={drawerState.mode}
          providers={providers}
          initialAccount={drawerState.account}
          onClose={closeDrawer}
        />
      ) : null}
    </HomeLayout>
  );
}
