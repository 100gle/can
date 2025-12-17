import { AccountFormDrawer } from "@/components/accounts/account-form-drawer";
import { AccountSelector } from "@/components/accounts/account-selector";
import { HomeLayout } from "@/components/layouts/home-layout";
import { showError, showSuccess } from "@/lib/toast";
import { exportAccounts, useAccounts, type AccountModel } from "@/hooks/useAccounts";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type DrawerState =
  | { open: false }
  | {
      open: true;
      mode: "create" | "edit";
      account?: AccountModel;
    };

const CLOSED_DRAWER: DrawerState = { open: false };

export default function HomePage() {
  const { t } = useTranslation();
  const { accounts, providers } = useAccounts();
  const [drawerState, setDrawerState] = useState<DrawerState>(CLOSED_DRAWER);

  const openDrawer = (mode: "create" | "edit", account?: AccountModel) => {
    setDrawerState({ open: true, mode, account });
  };

  const closeDrawer = () => setDrawerState(CLOSED_DRAWER);

  const handleExportAccounts = () => {
    if (!accounts.length) {
      showError(t("home.export.noAccounts"));
      return;
    }
    void exportAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const message = [
          t("home.export.success", { count: summary.count }),
          summary.filePath ? t("home.export.savePath", { path: summary.filePath }) : null,
        ]
          .filter(Boolean)
          .join("\n");
        showSuccess(message);
      })
      .catch((err: Error) => {
        showError(t("home.export.error", { error: err?.message ?? "Unknown error" }));
      });
  };

  return (
    <HomeLayout>
      <AccountSelector
        onCreateAccount={() => openDrawer("create")}
        onEditAccount={(account) => openDrawer("edit", account)}
        onExportAccount={handleExportAccounts}
      />
      {drawerState.open && (
        <AccountFormDrawer
          open
          mode={drawerState.mode}
          providers={providers}
          initialAccount={drawerState.account}
          onClose={closeDrawer}
        />
      )}
    </HomeLayout>
  );
}
