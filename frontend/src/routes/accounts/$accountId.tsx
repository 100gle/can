import { AccountFormDrawer } from "@/components/accounts/account-form-drawer";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { Button } from "@/components/ui/button";
import { AccountLayoutContext } from "@/contexts/account-layout-context";
import { AccountModel, accountsStore, useAccountsStore } from "@/state/accounts";
import { transfersStore } from "@/state/transfers";
import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/accounts/$accountId")({
  beforeLoad: async ({ params }) => {
    // Accounts already loaded in root route, just validate
    const state = accountsStore.getState();
    if (!state.accounts.length) {
      throw redirect({ to: "/" });
    }
    const exists = state.accounts.some((account) => account.id === params.accountId);
    if (!exists) {
      throw redirect({
        to: "/accounts/$accountId/dashboard",
        params: { accountId: state.accounts[0].id },
      });
    }
    //  Start transfer polling when entering account page
    transfersStore.startPolling();
  },
  onLeave: () => {
    // Stop transfer polling when leaving account pages
    transfersStore.stopPolling();
  },
  component: AccountLayout,
});

function AccountLayout() {
  const navigate = useNavigate();
  const { accountId } = Route.useParams();
  const { accounts, providers, activeAccountId, loading } = useAccountsStore((state) => state);
  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    account?: AccountModel;
  }>({
    open: false,
    mode: "create",
  });

  // Set active account when accountId changes
  useEffect(() => {
    if (activeAccountId !== accountId) {
      void accountsStore.setActiveAccount(accountId);
    }
  }, [activeAccountId, accountId]);

  // Active account setting and polling now handled in route's beforeLoad/onLeave
  // This ensures proper cleanup when navigating away

  const activeAccount = useMemo(() => {
    if (!accounts.length) return undefined;
    return accounts.find((account) => account.id === accountId) ?? accounts[0];
  }, [accounts, accountId]);

  const openDrawer = (mode: "create" | "edit", account?: AccountModel) => {
    setDrawerState({ open: true, mode, account });
  };

  const closeDrawer = () => setDrawerState((prev) => ({ ...prev, open: false }));

  const sidebar = <Sidebar onCreateAccount={() => openDrawer("create")} accountId={accountId} />;

  if (!activeAccount && loading) {
    return (
      <DashboardLayout sidebar={sidebar}>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">正在加载账户信息...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!activeAccount) {
    return (
      <DashboardLayout sidebar={sidebar}>
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          <div>
            <p>尚未配置任何账户，返回首页创建一个。</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
              返回首页
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebar={sidebar}
      accountName={activeAccount.name}
      accountMeta={`${activeAccount.providerLabel} · ${activeAccount.region || "Region 未设置"}`}
    >
      <AccountLayoutContext.Provider value={{ openDrawer }}>
        <Outlet />
      </AccountLayoutContext.Provider>
      {drawerState.open && (
        <AccountFormDrawer
          open
          mode={drawerState.mode}
          providers={providers}
          initialAccount={drawerState.account}
          onClose={closeDrawer}
        />
      )}
    </DashboardLayout>
  );
}
