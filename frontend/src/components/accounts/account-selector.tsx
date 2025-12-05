import { Button } from "@/components/ui/button";
import { accountsStore, useAccountsStore, type AccountModel } from "@/state/accounts";
import { useNavigate } from "@tanstack/react-router";
import { LayoutGrid, Loader2, Plus, RefreshCcw, Rows, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { AccountCardStatus } from "./account-card";
import { AccountCardGrid } from "./account-card-grid";

type AccountSelectorProps = {
  onCreateAccount: () => void;
  onEditAccount: (account: AccountModel) => void;
};

export const AccountSelector = ({ onCreateAccount, onEditAccount }: AccountSelectorProps) => {
  const navigate = useNavigate();
  const accounts = useAccountsStore((state) => state.accounts);
  const loading = useAccountsStore((state) => state.loading);
  const error = useAccountsStore((state) => state.error);
  const connectionTests = useAccountsStore((state) => state.connectionTests);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  useEffect(() => {
    void accountsStore.bootstrap();
  }, []);

  const handleSelectAccount = async (account: AccountModel) => {
    await accountsStore.setActiveAccount(account.id);
    navigate({
      to: "/accounts/$accountId/dashboard",
      params: { accountId: account.id },
    });
  };

  const handleRetry = () => {
    void accountsStore.refresh();
  };

  const statusByAccount = useMemo(() => {
    return accounts.reduce<Record<string, AccountCardStatus>>((acc, account) => {
      const probe = connectionTests[account.id];
      if (!probe || probe.status === "idle") {
        acc[account.id] = "pending";
      } else if (probe.status === "ok") {
        acc[account.id] = "ok";
      } else if (probe.status === "error") {
        acc[account.id] = "error";
      } else {
        acc[account.id] = "pending";
      }
      return acc;
    }, {});
  }, [accounts, connectionTests]);

  const renderGrid = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在加载账户列表...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleRetry}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      );
    }

    if (!accounts.length) {
      return <EmptyState onCreate={onCreateAccount} />;
    }

    return (
      <AccountCardGrid
        accounts={accounts}
        getStatus={(account) => statusByAccount[account.id] ?? "pending"}
        onSelectAccount={handleSelectAccount}
        layout={viewMode}
      />
    );
  };

  return (
    <section className="space-y-8 rounded-3xl border border-border/40 bg-background/70 p-6 shadow-2xl shadow-primary/5 backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Multi-Account
          </p>
          <h2 className="mt-2 text-3xl font-semibold">选择你的云存储账户</h2>
          <p className="text-sm text-muted-foreground">
            集中管理 S3 兼容服务，快速切换并查看连接状态。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-background/70 p-1">
            <Button
              type="button"
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="icon"
              aria-pressed={viewMode === "cards"}
              aria-label="卡片视图"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              aria-pressed={viewMode === "list"}
              aria-label="列表视图"
              onClick={() => setViewMode("list")}
            >
              <Rows className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm" className="gap-2" onClick={onCreateAccount}>
            <Plus className="h-4 w-4" />
            新建账户
          </Button>
        </div>
      </div>
      {renderGrid()}
    </section>
  );
};

const EmptyState = ({ onCreate }: { onCreate: () => void }) => (
  <div className="rounded-3xl border border-dashed border-border/60 p-10 text-center">
    <h3 className="text-2xl font-semibold">欢迎使用 CAN</h3>
    <p className="mt-2 text-sm text-muted-foreground">
      当前还没有配置任何账户，立即新建一个开始浏览 Bucket 与对象。
    </p>
    <Button className="mt-6 gap-2" onClick={onCreate}>
      <Plus className="h-4 w-4" />
      新建账户
    </Button>
  </div>
);
