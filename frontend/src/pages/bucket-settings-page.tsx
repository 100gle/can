import { BucketSettings, type BucketSettingsSection } from "@/components/buckets/bucket-settings";
import { CORSPanel } from "@/components/buckets/cors-panel";
import { EncryptionPanel } from "@/components/buckets/encryption-panel";
import { LifecyclePanel } from "@/components/buckets/lifecycle-panel";
import { VersioningPanel } from "@/components/buckets/versioning-panel";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { Button } from "@/components/ui/button";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { bucketConfigStore } from "@/state/bucketConfig";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const BucketSettingsPage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/accounts/$accountId/buckets/$bucketId/settings" });
  const { accounts, activeAccountId, loading } = useAccountsStore((state) => state);
  const [section, setSection] = useState("versioning");

  const account = useMemo(() => {
    return accounts.find((item) => item.id === params.accountId);
  }, [accounts, params.accountId]);

  useEffect(() => {
    void accountsStore.bootstrap();
  }, []);

  useEffect(() => {
    if (params.accountId && params.bucketId) {
      void bucketConfigStore.loadConfig(params.accountId, params.bucketId);
    }
  }, [params.accountId, params.bucketId]);

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
    { id: "versioning", label: "版本控制", render: () => <VersioningPanel /> },
    { id: "encryption", label: "默认加密", render: () => <EncryptionPanel /> },
    { id: "lifecycle", label: "生命周期", render: () => <LifecyclePanel /> },
    { id: "cors", label: "CORS 规则", render: () => <CORSPanel /> },
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
          onOpenSettings={() => navigate({ to: "/settings" })}
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
