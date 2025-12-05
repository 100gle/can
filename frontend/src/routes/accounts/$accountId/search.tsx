import { createFileRoute } from "@tanstack/react-router";
import { SearchPage } from "@/pages/search-page";
import { accountsStore } from "@/state/accounts";

type SearchParams = {
  bucket?: string;
};

export const Route = createFileRoute("/accounts/$accountId/search")({
  beforeLoad: async () => {
    await accountsStore.bootstrap();
  },
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    bucket: typeof search.bucket === "string" ? search.bucket : undefined,
  }),
  component: SearchPage,
});
