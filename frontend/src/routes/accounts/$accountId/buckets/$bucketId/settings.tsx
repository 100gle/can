import { createFileRoute } from "@tanstack/react-router";
import { BucketSettingsPage } from "@/pages/bucket-settings-page";
import { accountsStore } from "@/state/accounts";

export const Route = createFileRoute("/accounts/$accountId/buckets/$bucketId/settings")({
  beforeLoad: async () => {
    await accountsStore.bootstrap();
  },
  component: BucketSettingsPage,
});
