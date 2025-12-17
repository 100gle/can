import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import TransfersPage from "@/pages/transfers-page";
import { prefetchAccounts } from "@/hooks/useAccounts";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/transfers")({
  beforeLoad: async () => {
    const result = await prefetchAccounts();
    const accounts =
      (result as any)?.state?.data?.accounts ?? (result as any)?.data?.accounts ?? [];
    if (!accounts.length) throw redirect({ to: "/" });
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
