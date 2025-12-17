import type { ProviderFeature } from "@/state/accounts";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type CapabilityGateProps = {
  feature?: ProviderFeature;
  children: ReactNode;
};

export const CapabilityGate = ({ feature, children }: CapabilityGateProps) => {
  const { t } = useTranslation();
  if (!feature || feature.supported !== false) {
    return <>{children}</>;
  }
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">
        {feature.name || t("bucket.feature.defaultName")} {t("bucket.feature.unavailable")}
      </p>
      <p>{feature.message || t("bucket.feature.defaultReason")}</p>
    </div>
  );
};
