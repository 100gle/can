import type { ReactNode } from "react";
import type { ProviderCapability } from "@/state/accounts";

type CapabilityGateProps = {
  capability?: ProviderCapability;
  children: ReactNode;
};

export const CapabilityGate = ({ capability, children }: CapabilityGateProps) => {
  if (!capability || capability.supported !== false) {
    return <>{children}</>;
  }
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{capability.name || "此功能"}暂不可用</p>
      <p>{capability.message || "供应商限制导致该配置暂未开放。"}</p>
    </div>
  );
};
