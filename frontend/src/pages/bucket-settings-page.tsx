import { AccessControlPanel } from "@/components/buckets/access-control-panel";
import { BlockPublicAccessPanel } from "@/components/buckets/block-public-access-panel";
import { BucketSettings, type BucketSettingsSection } from "@/components/buckets/bucket-settings";
import { CapabilityGate } from "@/components/buckets/capability-gate";
import { CORSPanel } from "@/components/buckets/cors-panel";
import { EncryptionPanel } from "@/components/buckets/encryption-panel";
import { LifecyclePanel } from "@/components/buckets/lifecycle-panel";
import { PolicyPanel } from "@/components/buckets/policy-panel";
import { RefererProtectionPanel } from "@/components/buckets/referer-protection-panel";
import { SnapshotPanel } from "@/components/buckets/snapshot-panel";
import { VersioningPanel } from "@/components/buckets/versioning-panel";
import { WebsitePanel } from "@/components/buckets/website-panel";
import { Button } from "@/components/ui/button";
import { useCapabilities, type ProviderCapability } from "@/hooks/useCapabilities";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { bucketConfigStore, type BucketFeature } from "@/state/bucketConfig";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const FEATURE_CAPABILITY_IDS: Record<BucketFeature, string> = {
  versioning: "bucket.versioning",
  encryption: "bucket.encryption",
  lifecycle: "bucket.lifecycle",
  cors: "bucket.cors",
  website: "bucket.website",
  policy: "bucket.policy",
  acl: "bucket.acl",
  publicAccess: "bucket.public_access_block",
  referer: "bucket.referer",
};

export const BucketSettingsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ from: "/accounts/$accountId/buckets/$bucketId/settings" });
  const { accounts, activeAccountId, loading } = useAccountsStore((state) => state);
  const [section, setSection] = useState("versioning");

  // Use dynamic capabilities hook instead of static global state
  const { capabilities: providerCapabilities, loading: capsLoading } = useCapabilities(
    params.accountId,
  );

  const account = useMemo(() => {
    return accounts.find((item) => item.id === params.accountId);
  }, [accounts, params.accountId]);

  const capabilitiesReady = providerCapabilities.length > 0 && !capsLoading;

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
      <main className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        {t("bucket.settings.page.loadingAccount")}
      </main>
    );
  }

  if (!account) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <p>{t("bucket.settings.page.accountNotFound")}</p>
        <Button
          onClick={() =>
            navigate({
              to: "/accounts/$accountId/dashboard",
              params: { accountId: activeAccountId ?? accounts[0].id },
            })
          }
        >
          {t("common.back")}
        </Button>
      </main>
    );
  }

  const sections = useMemo<BucketSettingsSection[]>(
    () => [
      {
        id: "acl",
        label: t("bucket.acl.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.acl}>
            <AccessControlPanel provider={account.provider} />
          </CapabilityGate>
        ),
      },
      {
        id: "public-access",
        label: t("bucket.publicAccess.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.publicAccess}>
            <BlockPublicAccessPanel provider={account.provider} />
          </CapabilityGate>
        ),
      },
      {
        id: "versioning",
        label: t("bucket.versioning.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.versioning}>
            <VersioningPanel />
          </CapabilityGate>
        ),
      },
      {
        id: "encryption",
        label: t("bucket.encryption.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.encryption}>
            <EncryptionPanel />
          </CapabilityGate>
        ),
      },
      {
        id: "lifecycle",
        label: t("bucket.lifecycle.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.lifecycle}>
            <LifecyclePanel />
          </CapabilityGate>
        ),
      },
      {
        id: "cors",
        label: t("bucket.cors.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.cors}>
            <CORSPanel />
          </CapabilityGate>
        ),
      },
      {
        id: "policy",
        label: t("bucket.policy.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.policy}>
            <PolicyPanel />
          </CapabilityGate>
        ),
      },
      {
        id: "referer",
        label: t("bucket.referer.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.referer}>
            <RefererProtectionPanel provider={account.provider} />
          </CapabilityGate>
        ),
      },
      {
        id: "snapshot",
        label: t("bucket.snapshot.title"),
        render: () => <SnapshotPanel />,
      },
      {
        id: "website",
        label: t("bucket.website.title"),
        render: () => (
          <CapabilityGate capability={featureMatrix.website}>
            <WebsitePanel />
          </CapabilityGate>
        ),
      },
    ],
    [t, featureMatrix, account.provider],
  );

  return (
    <main className="flex-1 overflow-auto p-6 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {account.name} · {t("bucket.settings.page.subHeader")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{params.bucketId}</h2>
        <p className="text-sm text-muted-foreground">{t("bucket.settings.page.description")}</p>
      </div>
      <BucketSettings sections={sections} activeSection={section} onSectionChange={setSection} />
    </main>
  );
};
