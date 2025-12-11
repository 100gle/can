import type { ProviderCapability } from "@/state/accounts";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

type CapabilityGateProps = {
  capability?: ProviderCapability;
  children: ReactNode;
};

export const CapabilityGate = ({ capability, children }: CapabilityGateProps) => {
  const { t } = useTranslation();
  if (!capability || capability.supported !== false) {
    return <>{children}</>;
  }
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">
        {capability.name || t("bucket.capability.defaultName")} {t("bucket.capability.unavailable")}
      </p>
      <p>{capability.message || t("bucket.capability.defaultReason")}</p>
    </div>
  );
};
