import TransfersPage from "@/pages/transfers-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/accounts/$accountId/transfers")({
  component: TransfersPage,
});
