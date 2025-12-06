import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { createFileRoute } from "@tanstack/react-router";
import { AnalyticsPage } from "../pages/analytics-page";

const AnalyticsRouteComponent = () => (
  <DashboardLayout sidebar={<Sidebar />} showSettingsShortcut={true} accountName="Analytics">
    <main className="flex min-h-full flex-col">
      <AnalyticsPage />
    </main>
  </DashboardLayout>
);

export const Route = createFileRoute("/analytics")({
  component: AnalyticsRouteComponent,
});
