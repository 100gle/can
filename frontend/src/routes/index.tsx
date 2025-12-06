import HomePage from "@/pages/home-page";
import { accountsStore } from "@/state/accounts";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await accountsStore.bootstrap();
  },
  component: HomePage,
});
