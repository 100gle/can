import {
  DownloadCloud,
  Loader2,
  Plus,
  RefreshCcw,
  Share2,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Sidebar } from "@/components/layouts/Sidebar";
import { AccountFormDrawer } from "@/components/accounts/AccountFormDrawer";
import { ConnectionTestButton } from "@/components/accounts/ConnectionTestButton";
import { BucketBrowser } from "@/components/buckets/BucketBrowser";
import { ObjectBrowser } from "@/components/objects/ObjectBrowser";
import { UploadProgress } from "@/components/transfer/UploadProgress";
import { accountsStore, useAccountsStore, type AccountModel } from "@/state/accounts";
import { useBucketsStore } from "@/state/buckets";
import { transfersStore } from "@/state/transfers";

const futureModules = [
  { title: "Bucket 属性与策略", detail: "Versioning · CORS · Policy" },
  { title: "对象批量操作", detail: "复制 / 移动 / 标签" },
  { title: "传输调度", detail: "分片上传 · 队列管理" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const params = useParams({ from: "/accounts/$accountId/dashboard" });
  const routeAccountId = params.accountId;
  const { accounts, providers, capabilities, loading, error, activeAccountId } = useAccountsStore(
    (state) => state,
  );
  const selectedBucket = useBucketsStore((state) => state.selectedBucket);
  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    mode: "create" | "edit";
    account?: AccountModel;
  }>({
    open: false,
    mode: "create",
  });

  useEffect(() => {
    void accountsStore.bootstrap();
  }, []);

  useEffect(() => {
    transfersStore.startPolling();
  }, []);

  useEffect(() => {
    if (!accounts.length || !routeAccountId) return;
    const exists = accounts.some((account) => account.id === routeAccountId);
    if (!exists) {
      navigate({
        to: "/accounts/$accountId/dashboard",
        params: { accountId: accounts[0].id },
        replace: true,
      });
      return;
    }
    if (activeAccountId !== routeAccountId) {
      void accountsStore.setActiveAccount(routeAccountId);
    }
  }, [accounts, activeAccountId, routeAccountId, navigate]);

  useEffect(() => {
    if (!loading && !accounts.length) {
      navigate({ to: "/" });
    }
  }, [accounts, loading, navigate]);

  const activeAccount = useMemo(() => {
    if (!accounts.length) return undefined;
    if (routeAccountId) {
      return accounts.find((account) => account.id === routeAccountId) ?? accounts[0];
    }
    return accounts.find((account) => account.id === activeAccountId) ?? accounts[0];
  }, [accounts, routeAccountId, activeAccountId]);

  const activeCapabilities = useMemo(() => {
    if (!activeAccount) return [];
    return capabilities.filter((cap) => cap.provider === activeAccount.provider);
  }, [capabilities, activeAccount]);

  const openDrawer = (mode: "create" | "edit", account?: AccountModel) => {
    setDrawerState({ open: true, mode, account });
  };

  const closeDrawer = () => setDrawerState((prev) => ({ ...prev, open: false }));

  const handleRefresh = () => {
    void accountsStore.refresh();
  };

  const handleExportAccounts = () => {
    if (!accounts.length) {
      window.alert?.("暂无可导出的账户");
      return;
    }
    void accountsStore
      .exportAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const message = [
          `已导出 ${summary.count} 个账户`,
          summary.filePath ? `保存位置：${summary.filePath}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        window.alert?.(message);
      })
      .catch(() => {
        /* handled */
      });
  };

  const handleImportAccounts = () => {
    void accountsStore
      .importAccounts()
      .then((summary) => {
        if (!summary || summary.cancelled) return;
        const lines = [
          `成功导入 ${summary.imported}/${summary.total} 个账户`,
          summary.skipped ? `跳过 ${summary.skipped} 个` : null,
          summary.failed ? `失败 ${summary.failed} 个` : null,
        ].filter(Boolean);
        if (summary.issues?.length) {
          lines.push("详情：");
          summary.issues.forEach((issue) => lines.push(`- ${issue}`));
        }
        window.alert?.(lines.join("\n"));
      })
      .catch(() => {
        /* handled */
      });
  };

  const handleOpenSettings = () => {
    navigate({ to: "/settings" });
  };

  const handleOpenBucketSettings = (bucketName: string) => {
    if (!activeAccount) return;
    navigate({
      to: "/accounts/$accountId/buckets/$bucketId/settings",
      params: { accountId: activeAccount.id, bucketId: bucketName },
    });
  };

  const handleOpenSearch = () => {
    if (!activeAccount) return;
    navigate({
      to: "/accounts/$accountId/search",
      params: { accountId: activeAccount.id },
      search: { bucket: selectedBucket },
    });
  };

  const sidebar = (
    <Sidebar onCreateAccount={() => openDrawer("create")} onOpenSettings={handleOpenSettings} />
  );

  if (!activeAccount && loading) {
    return (
      <DashboardLayout sidebar={sidebar}>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="ml-2 text-sm">正在加载账户信息...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!activeAccount) {
    return (
      <DashboardLayout sidebar={sidebar}>
        <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          <div>
            <p>尚未配置任何账户，返回首页创建一个。</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
              返回首页
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout sidebar={sidebar}>
      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-border/40 bg-gradient-to-br from-background via-background/80 to-background/40 p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                当前会话账户
              </p>
              <h2 className="mt-1 truncate text-2xl font-semibold sm:text-3xl">
                {activeAccount.name}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {activeAccount.providerLabel} · {activeAccount.region || "Region 未设置"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleRefresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
                刷新
              </Button>
              <Button variant="outline" size="sm" className="gap-1" onClick={handleImportAccounts}>
                <UploadCloud className="h-4 w-4" />
                导入
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleExportAccounts}
                disabled={!accounts.length}
              >
                <DownloadCloud className="h-4 w-4" />
                导出
              </Button>
              <ConnectionTestButton accountId={activeAccount.id} disabled={loading} />
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={!activeAccount}
                onClick={() => openDrawer("edit", activeAccount)}
              >
                编辑账户
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={!activeAccount}
                onClick={() =>
                  navigate({
                    to: "/accounts/$accountId/transfers",
                    params: { accountId: activeAccount?.id ?? "" },
                  })
                }
              >
                <Share2 className="h-4 w-4" />
                传输队列
              </Button>
              <Button size="sm" className="gap-1" onClick={() => openDrawer("create")}>
                <Plus className="h-4 w-4" />
                新建
              </Button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </header>

        <section className="grid gap-4 overflow-x-hidden p-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">凭证摘要</p>
                <h3 className="mt-2 truncate text-lg font-semibold">
                  {activeAccount.accessKeyPreview || "-"}
                </h3>
              </div>
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <dt className="font-medium">Endpoint</dt>
                <dd className="truncate text-foreground">{activeAccount.endpoint}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-medium">SSL</dt>
                <dd>{activeAccount.useSSL ? "已开启" : "未启用"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="font-medium">端口</dt>
                <dd>{activeAccount.port || 443}</dd>
              </div>
            </dl>
          </Card>
          <Card className="lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">下一步</p>
                <h3 className="mt-2 text-lg font-semibold">Roadmap Modules</h3>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {futureModules.map((module) => (
                <div key={module.title} className="rounded-2xl border border-border/40 p-3">
                  <p className="text-sm font-semibold">{module.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{module.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 p-4 lg:grid-cols-3">
          <BucketBrowser
            accountId={activeAccount.id}
            providerId={activeAccount.provider}
            capabilities={activeCapabilities}
            onOpenSettings={handleOpenBucketSettings}
            className="lg:col-span-1"
          />
          <ObjectBrowser
            accountId={activeAccount.id}
            bucket={selectedBucket}
            onOpenSearch={handleOpenSearch}
            className="lg:col-span-2"
          />
        </section>
        <section className="p-4">
          <UploadProgress />
        </section>
      </main>

      {drawerState.open ? (
        <AccountFormDrawer
          open
          mode={drawerState.mode}
          providers={providers}
          initialAccount={drawerState.account}
          onClose={closeDrawer}
        />
      ) : null}
    </DashboardLayout>
  );
}
