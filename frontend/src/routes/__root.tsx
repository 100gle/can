import { AppEventsBridge } from "@/components/providers/app-events-bridge";
import { Toaster } from "@/components/ui/sonner";
import { accountsStore } from "@/state/accounts";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  beforeLoad: async () => {
    // Global initialization - load accounts list once on app startup
    await accountsStore.bootstrap();
  },
  component: () => (
    <>
      <AppEventsBridge />
      <Outlet />
      <Toaster position="top-right" />
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </>
  ),
});
