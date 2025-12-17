import { AppEventsBridge } from "@/components/providers/app-events-bridge";
import { SettingsSync } from "@/components/providers/settings-sync";
import { DropOverlay } from "@/components/transfer/drop-overlay";
import { Toaster } from "@/components/ui/sonner";
import { prefetchAccounts } from "@/hooks/useAccounts";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  beforeLoad: async () => {
    // Global initialization - load accounts list once on app startup
    await prefetchAccounts();
  },
  component: () => (
    <>
      <SettingsSync />
      <AppEventsBridge />
      <DropOverlay />
      <Outlet />
      <Toaster position="top-right" />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-left" />}
    </>
  ),
});
