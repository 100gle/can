import { PageHeader } from "@/components/layouts/page-header";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { DataSecurityCard } from "@/components/settings/data-security-card";
import { OtherSettingsCard } from "@/components/settings/other-settings-card";
import { TransferCacheCard } from "@/components/settings/transfer-cache-card";

import { useTranslation } from "react-i18next";

export default function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-8 bg-muted/30 min-h-screen">
      <PageHeader title={t("common.settings")} description={t("settings.description")} showBack />

      <div className="space-y-6">
        <AppearanceCard />
        <DataSecurityCard />
        <TransferCacheCard />
        <OtherSettingsCard />
      </div>
    </div>
  );
}
