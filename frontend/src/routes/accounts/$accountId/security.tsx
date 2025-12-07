import SecurityPage from "@/pages/security-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/accounts/$accountId/security")({
  component: SecurityPage,
});
