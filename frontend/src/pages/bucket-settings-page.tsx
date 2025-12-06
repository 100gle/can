import { BucketSettings, type BucketSettingsSection } from "@/components/buckets/bucket-settings";
import { CapabilityGate } from "@/components/buckets/capability-gate";
import { CORSPanel } from "@/components/buckets/cors-panel";
import { EncryptionPanel } from "@/components/buckets/encryption-panel";
import { LifecyclePanel } from "@/components/buckets/lifecycle-panel";
import { PolicyPanel } from "@/components/buckets/policy-panel";
import { SnapshotPanel } from "@/components/buckets/snapshot-panel";
import { VersioningPanel } from "@/components/buckets/versioning-panel";
import { WebsitePanel } from "@/components/buckets/website-panel";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { Button } from "@/components/ui/button";
import { accountsStore, useAccountsStore, type ProviderCapability } from "@/state/accounts";
import { bucketConfigStore, type BucketFeature } from "@/state/bucketConfig";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const FEATURE_CAPABILITY_IDS: Record<BucketFeature, string> = {
  versioning: "bucket.versioning",
  encryption: "bucket.encryption",
  lifecycle: "bucket.lifecycle",
  cors: "bucket.cors",
  website: "bucket.website",
  policy: "bucket.policy",
};

export const BucketSettingsPage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/accounts/$accountId/buckets/$bucketId/settings" });
  const { accounts, activeAccountId, loading, capabilities } = useAccountsStore((state) => state);
  const [section, setSection] = useState("versioning");

  const account = useMemo(() => {
    return accounts.find((item) => item.id === params.accountId);
  }, [accounts, params.accountId]);

  const providerCapabilities = useMemo(() => {
    if (!account) return [] as ProviderCapability[];
    return capabilities.filter((capability) => capability.provider === account.provider);
  }, [account, capabilities]);

  const capabilitiesReady = providerCapabilities.length > 0;

  const featureMatrix = useMemo(() => {
    const matrix: Partial<Record<BucketFeature, ProviderCapability>> = {};
    if (!providerCapabilities.length) {
      return matrix;
    }
    const byId = new Map(
      providerCapabilities.map((capability) => [capability.featureId, capability]),
    );
    (Object.keys(FEATURE_CAPABILITY_IDS) as BucketFeature[]).forEach((feature) => {
      const capability = byId.get(FEATURE_CAPABILITY_IDS[feature]);
      if (capability) {
        matrix[feature] = capability;
      }
    });
    return matrix;
  }, [providerCapabilities]);

  useEffect(() => {
    void accountsStore.bootstrap();
  }, []);

  useEffect(() => {
    if (!params.accountId || !params.bucketId) return;
    if (!account || !capabilitiesReady) return;
    void bucketConfigStore.loadConfig(params.accountId, params.bucketId, featureMatrix);
  }, [account, capabilitiesReady, params.accountId, params.bucketId, featureMatrix]);

  if (!account && (loading || !accounts.length)) {
    return (
      <DashboardLayout sidebar={<Sidebar />}>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          正在加载账户...
        </div>
      </DashboardLayout>
    );
  }

  if (!account) {
    return (
      <DashboardLayout sidebar={<Sidebar />}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
          <p>未找到目标账户，请返回仪表盘。</p>
          <Button
            onClick={() =>
              navigate({
                to: "/accounts/$accountId/dashboard",
                params: { accountId: activeAccountId ?? accounts[0].id },
              })
            }
          >
            返回
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const sections: BucketSettingsSection[] = [
    {
      id: "versioning",
      label: "版本控制",
      render: () => (
        <CapabilityGate capability={featureMatrix.versioning}>
          <VersioningPanel />
        </CapabilityGate>
      ),
    },
    {
      id: "encryption",
      label: "默认加密",
      render: () => (
        <CapabilityGate capability={featureMatrix.encryption}>
          <EncryptionPanel />
        </CapabilityGate>
      ),
    },
    {
      id: "lifecycle",
      label: "生命周期",
      render: () => (
        <CapabilityGate capability={featureMatrix.lifecycle}>
          <LifecyclePanel />
        </CapabilityGate>
      ),
    },
    {
      id: "cors",
      label: "CORS 规则",
      render: () => (
        <CapabilityGate capability={featureMatrix.cors}>
          <CORSPanel />
        </CapabilityGate>
      ),
    },
    {
      id: "policy",
      label: "访问策略",
      render: () => (
        <CapabilityGate capability={featureMatrix.policy}>
          <PolicyPanel />
        </CapabilityGate>
      ),
    },
    {
      id: "snapshot",
      label: "快照备份",
      render: () => <SnapshotPanel />,
    },
    {
      id: "website",
      label: "静态网站",
      render: () => (
        <CapabilityGate capability={featureMatrix.website}>
          <WebsitePanel />
        </CapabilityGate>
      ),
    },
  ];

  return (
    <DashboardLayout
      sidebar={
        <Sidebar
          onCreateAccount={() =>
            navigate({
              to: "/accounts/$accountId/dashboard",
              params: { accountId: params.accountId },
            })
          }
        />
      }
    >
      <main className="space-y-6 p-4 md:p-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {account.name} · Bucket 设置
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{params.bucketId}</h2>
          <p className="text-sm text-muted-foreground">
            这里可以管理版本控制、默认加密以及跨域策略。
          </p>
        </div>
        <BucketSettings sections={sections} activeSection={section} onSectionChange={setSection} />
      </main>
    </DashboardLayout>
  );
};
