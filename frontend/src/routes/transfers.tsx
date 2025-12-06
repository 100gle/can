import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import TransfersPage from "@/pages/transfers-page";
import { accountsStore } from "@/state/accounts";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/transfers")({
  beforeLoad: async () => {
    await accountsStore.bootstrap();
    const state = accountsStore.getState();
    if (!state.accounts.length) {
      throw redirect({ to: "/" });
    }
  },
  component: TransfersRoute,
});

function TransfersRoute() {
  return (
    <DashboardLayout sidebar={<Sidebar />}>
      <TransfersPage />
    </DashboardLayout>
  );
}
