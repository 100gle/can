import { createFileRoute, redirect } from "@tanstack/react-router";
import TransfersPage from "@/pages/TransfersPage";
import { accountsStore } from "@/state/accounts";

export const Route = createFileRoute("/accounts/$accountId/transfers")({
  beforeLoad: async ({ params }) => {
    await accountsStore.bootstrap();
    const state = accountsStore.getState();
    if (!state.accounts.length) {
      throw redirect({ to: "/" });
    }
    const exists = state.accounts.some((account) => account.id === params.accountId);
    if (!exists) {
      throw redirect({
        to: "/accounts/$accountId/transfers",
        params: { accountId: state.accounts[0].id },
      });
    }
  },
  component: TransfersPage,
});
