import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import HelpPage from "@/pages/help-page";
import { createFileRoute } from "@tanstack/react-router";

const HelpRouteComponent = () => (
  <DashboardLayout sidebar={<Sidebar />} showSettingsShortcut={false}>
    <HelpPage />
  </DashboardLayout>
);

export const Route = createFileRoute("/help")({
  component: HelpRouteComponent,
});
