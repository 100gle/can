import { AccountFormDrawer } from "@/components/accounts/account-form-drawer";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { Button } from "@/components/ui/button";
import { AccountLayoutContext } from "@/contexts/account-layout-context";
import {
  type AccountModel,
  getAccountsSnapshot,
  prefetchAccounts,
  setActiveAccount,
  useAccounts,
} from "@/hooks/useAccounts";
import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/accounts/$accountId")({
  beforeLoad: async ({ params }) => {
    // Accounts already loaded in root route, just validate
    await prefetchAccounts();
    const snapshot = getAccountsSnapshot();
    const accounts = snapshot?.accounts ?? [];
    if (!accounts.length) {
      throw redirect({ to: "/" });
    }
    const exists = accounts.some((account: AccountModel) => account.id === params.accountId);
    if (!exists) {
      throw redirect({
        to: "/accounts/$accountId/dashboard",
        params: { accountId: accounts[0].id },
      });
    }
    // Polling is now handled by React Query hooks
  },
  component: AccountLayout,
});

function AccountLayout() {
  const navigate = useNavigate();
  const { accountId } = Route.useParams();
  const { accounts, providers, activeAccountId, loading } = useAccounts();
  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    account?: AccountModel;
  }>({
    open: false,
    mode: "create",
  });
  const { t } = useTranslation();

  // Set active account when accountId changes
  useEffect(() => {
    if (activeAccountId !== accountId) {
      void setActiveAccount(accountId);
    }
  }, [activeAccountId, accountId]);

  // Active account setting and polling now handled in route's beforeLoad/onLeave
  // This ensures proper cleanup when navigating away

  const activeAccount = useMemo(() => {
    if (!accounts.length) return undefined;
    return accounts.find((account: AccountModel) => account.id === accountId) ?? accounts[0];
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
          <span className="ml-2 text-sm">{t("account.route.loading")}</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!activeAccount) {
    return (
      <DashboardLayout sidebar={sidebar}>
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          <div>
            <p>{t("account.route.empty")}</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
              {t("account.route.backToHome")}
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
      accountMeta={`${activeAccount.providerLabel} · ${activeAccount.region || t("account.card.regionNotSet")}`}
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
