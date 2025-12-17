import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import SettingsPage from "@/pages/settings-page";
import { createFileRoute } from "@tanstack/react-router";

const SettingsRouteComponent = () => (
  <DashboardLayout sidebar={<Sidebar />} showSettingsShortcut={false}>
    <main className="flex min-h-full flex-col">
      <SettingsPage />
    </main>
  </DashboardLayout>
);

export const Route = createFileRoute("/settings")({
  component: SettingsRouteComponent,
});
