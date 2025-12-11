import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountsStore, useAccountsStore, type AccountModel } from "@/state/accounts";
import { useNavigate } from "@tanstack/react-router";
import {
  DownloadCloud,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCcw,
  Rows,
  UploadCloud,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AccountCardGrid } from "./account-card-grid";

type AccountSelectorProps = {
  onCreateAccount: () => void;
  onEditAccount: (account: AccountModel) => void;
  onImportAccount?: () => void;
  onExportAccount?: () => void;
};

export const AccountSelector = ({
  onCreateAccount,
  onEditAccount,
  onImportAccount,
  onExportAccount,
}: AccountSelectorProps) => {
  const navigate = useNavigate();
  const accounts = useAccountsStore((state) => state.accounts);
  const loading = useAccountsStore((state) => state.loading);
  const error = useAccountsStore((state) => state.error);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [pendingDelete, setPendingDelete] = useState<AccountModel | null>(null);

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

  const handleDeleteAccount = (account: AccountModel) => {
    setPendingDelete(account);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await accountsStore.deleteAccount(pendingDelete.id).catch(() => {
      /* error handled in store */
    });
    setPendingDelete(null);
  };

  const renderGrid = (layout: "cards" | "list") => {
    if (loading) {
      return (
        <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在加载账户列表...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={handleRetry}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </div>
      );
    }

    if (!accounts.length) {
      return <EmptyState onCreate={onCreateAccount} onImport={onImportAccount} />;
    }

    return (
      <AccountCardGrid
        accounts={accounts}
        onSelectAccount={handleSelectAccount}
        onEditAccount={onEditAccount}
        onDeleteAccount={handleDeleteAccount}
        layout={layout}
      />
    );
  };

  return (
    <section>
      <Tabs
        value={viewMode}
        onValueChange={(value) => setViewMode(value as "cards" | "list")}
        className="gap-4"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-8">
            <div>
              <h2 className="text-2xl font-semibold">选择你的云存储账户</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                集中管理 S3 兼容服务，快速切换并查看连接状态。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {accounts.length > 0 && (
              <>
                {/* Mobile Tabs List for smaller screens */}

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="gap-2" onClick={onImportAccount}>
                    <UploadCloud className="h-4 w-4" />
                    导入
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={onExportAccount}>
                    <DownloadCloud className="h-4 w-4" />
                    导出
                  </Button>
                </div>

                <div className="hidden h-6 w-px bg-border sm:block" />

                <Button size="sm" className="gap-2" onClick={onCreateAccount}>
                  <Plus className="h-4 w-4" />
                  新建账户
                </Button>
              </>
            )}
          </div>
        </div>
        {accounts.length > 0 && (
          <div className="flex justify-start">
            <TabsList className="flex rounded-lg border border-border/60 bg-muted/20 p-1 text-muted-foreground shadow-inner shadow-black/5 backdrop-blur-sm">
              <TabsTrigger
                value="cards"
                aria-label="卡片视图"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/30 data-[state=active]:ring-1 data-[state=active]:ring-primary/40"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">卡片</span>
              </TabsTrigger>
              <TabsTrigger
                value="list"
                aria-label="列表视图"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:shadow-primary/30 data-[state=active]:ring-1 data-[state=active]:ring-primary/40"
              >
                <Rows className="h-4 w-4" />
                <span className="hidden sm:inline">列表</span>
              </TabsTrigger>
            </TabsList>
          </div>
        )}
        <TabsContent value="cards">{renderGrid("cards")}</TabsContent>
        <TabsContent value="list">{renderGrid("list")}</TabsContent>
      </Tabs>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定删除账户？</AlertDialogTitle>
            <AlertDialogDescription>
              即将删除账户"{pendingDelete?.name}"，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

const EmptyState = ({ onCreate, onImport }: { onCreate: () => void; onImport?: () => void }) => (
  <div className="rounded-xl border border-dashed border-border/60 p-10 text-center">
    <h3 className="text-xl font-semibold">欢迎使用 CAN</h3>
    <p className="mt-2 text-sm text-muted-foreground">
      当前还没有配置任何账户，立即新建一个开始浏览 Bucket 与对象。
    </p>
    <div className="mt-6 flex items-center justify-center gap-4">
      <Button variant="outline" className="gap-2" onClick={onImport}>
        <UploadCloud className="h-4 w-4" />
        导入配置
      </Button>
      <Button className="gap-2" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        新建账户
      </Button>
    </div>
  </div>
);
