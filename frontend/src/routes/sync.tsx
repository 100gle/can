import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { SyncPanel } from "@/components/sync/sync-panel";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sync")({
  component: SyncPage,
});

function SyncPage() {
  return (
    <DashboardLayout sidebar={<Sidebar />}>
      <SyncPanel />
    </DashboardLayout>
  );
}
