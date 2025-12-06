import { AccountFormDrawer } from "@/components/accounts/account-form-drawer";
import { ConnectionTestButton } from "@/components/accounts/connection-test-button";
import { FileExplorer } from "@/components/browser/file-explorer";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { Sidebar } from "@/components/layouts/sidebar";
import { UploadProgress } from "@/components/transfer/upload-progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { accountsStore, useAccountsStore, type AccountModel } from "@/state/accounts";
import { transfersStore } from "@/state/transfers";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  DownloadCloud,
  Loader2,
  Plug,
  Plus,
  RefreshCcw,
  Server,
  Share2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function DashboardPage() {
  const navigate = useNavigate();
  const params = useParams({ from: "/accounts/$accountId/dashboard" });
  const routeAccountId = params.accountId;
  const { accounts, providers, capabilities, loading, error, activeAccountId } = useAccountsStore(
    (state) => state,
  );
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
    <DashboardLayout
      sidebar={sidebar}
      accountName={activeAccount.name}
      accountMeta={`${activeAccount.providerLabel} · ${activeAccount.region || "Region 未设置"}`}
    >
      <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="border-b border-border/40 bg-gradient-to-br from-background via-background/80 to-background/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex min-w-0 items-center gap-2">
                <Server className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="shrink-0 text-foreground/80">Endpoint:</span>
                <span className="truncate text-foreground">{activeAccount.endpoint}</span>
              </li>
              <li className="flex min-w-0 items-center gap-2">
                <ShieldCheck
                  className={`h-4 w-4 shrink-0 ${
                    activeAccount.useSSL ? "text-emerald-500" : "text-amber-500"
                  }`}
                  aria-hidden="true"
                />
                <span className="shrink-0 text-foreground/80">SSL:</span>
                <span className="truncate text-foreground">
                  {activeAccount.useSSL ? "已开启" : "未启用"}
                </span>
              </li>
              <li className="flex min-w-0 items-center gap-2">
                <Plug className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="shrink-0 text-foreground/80">端口:</span>
                <span className="truncate text-foreground">{activeAccount.port || 443}</span>
              </li>
            </ul>
          </Card>
        </section>

        <section className="flex-1 p-4">
          <FileExplorer
            accountId={activeAccount.id}
            providerId={activeAccount.provider}
            onOpenBucketSettings={handleOpenBucketSettings}
            className="h-full"
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
