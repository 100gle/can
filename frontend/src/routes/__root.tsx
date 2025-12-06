import { ThemeProvider } from "@/components/providers/theme-provider";
import { DropOverlay } from "@/components/transfer/drop-overlay";
import { accountsStore } from "@/state/accounts";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";

const RootComponent = () => {
  useEffect(() => {
    void accountsStore.bootstrap();
  }, []);

  return (
    <>
      <ThemeProvider />
      <DropOverlay />
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
});
