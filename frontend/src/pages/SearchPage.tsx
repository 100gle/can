import { useEffect } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Sidebar } from "@/components/layouts/Sidebar";
import { SearchPanel } from "@/components/search/SearchPanel";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { bucketsStore, useBucketsStore } from "@/state/buckets";
import { searchStore } from "@/state/search";
import { Route } from "@/routes/accounts/$accountId/search";

export const SearchPage = () => {
  const navigate = useNavigate();
  const params = useParams({ from: "/accounts/$accountId/search" });
  const searchParams = Route.useSearch();
  const { accounts, loading } = useAccountsStore((state) => state);
  const buckets = useBucketsStore((state) => state.buckets);

  useEffect(() => {
    void accountsStore.bootstrap();
  }, []);

  useEffect(() => {
    if (params.accountId) {
      searchStore.setContext(params.accountId, searchParams.bucket);
      void bucketsStore.loadBuckets(params.accountId);
    }
  }, [params.accountId, searchParams.bucket]);

  if (!accounts.length && loading) {
    return (
      <DashboardLayout sidebar={<Sidebar />}>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">加载账户中...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      sidebar={
        <Sidebar
          onCreateAccount={() =>
            navigate({ to: "/accounts/$accountId/dashboard", params: { accountId: params.accountId } })
          }
          onOpenSettings={() => navigate({ to: "/settings" })}
        />
      }
    >
      <main className="space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              账户 {params.accountId}
            </p>
            <h2 className="text-2xl font-semibold">对象搜索</h2>
            <p className="text-sm text-muted-foreground">跨存储桶执行关键字和过滤搜索，快速定位对象。</p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              navigate({ to: "/accounts/$accountId/dashboard", params: { accountId: params.accountId } })
            }
          >
            返回仪表盘
          </Button>
        </div>
        <SearchPanel buckets={buckets.map((bucket) => bucket.name)} />
      </main>
    </DashboardLayout>
  );
};
