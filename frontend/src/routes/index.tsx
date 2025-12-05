import { createFileRoute, redirect } from "@tanstack/react-router";
import HomePage from "@/pages/home-page";
import { accountsStore } from "@/state/accounts";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await accountsStore.bootstrap();
    const state = accountsStore.getState();
    if (state.accounts.length === 1 && state.activeAccountId) {
      throw redirect({
        to: "/accounts/$accountId/dashboard",
        params: { accountId: state.activeAccountId },
      });
    }
  },
  component: HomePage,
});
