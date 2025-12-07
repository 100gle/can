import { PageHeader } from "@/components/layouts/page-header";
import { SecurityDashboard } from "@/components/security";
import { useParams } from "@tanstack/react-router";

export default function SecurityPage() {
  const params = useParams({ from: "/accounts/$accountId/security" });

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <PageHeader title="安全中心" description="管理存储桶安全配置，执行合规性检查" showBack />
      <section className="flex-1 overflow-auto p-6">
        <SecurityDashboard accountId={params.accountId} />
      </section>
    </main>
  );
}

