import { ThemeProvider } from "@/components/providers/ThemeProvider";
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
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
});
