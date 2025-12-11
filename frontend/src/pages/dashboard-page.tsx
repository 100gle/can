import { FileExplorer } from "@/components/browser/file-explorer";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAccountLayout } from "@/contexts/account-layout-context";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { bucketsStore } from "@/state/buckets";
import { objectsStore } from "@/state/objects";
import { useNavigate, useParams } from "@tanstack/react-router";
import { RefreshCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // params are strictly typed, but we know we are under /accounts/$accountId
  const { accountId } = useParams({ from: "/accounts/$accountId/dashboard" });
  const { accounts, error } = useAccountsStore((state) => state);
  const [refreshing, setRefreshing] = useState(false);

  // Get openDrawer from layout context
  const { openDrawer } = useAccountLayout();

  const activeAccount = useMemo(() => {
    if (!accounts.length) return undefined;
    return accounts.find((account) => account.id === accountId) ?? accounts[0];
  }, [accounts, accountId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const refreshPromise = Promise.all([
        accountsStore.refresh(),
        accountId ? bucketsStore.loadBuckets(accountId) : Promise.resolve(),
        objectsStore.refresh(),
      ]);

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(t("dashboard.refreshTimeout"))), 30000),
      );

      await Promise.race([refreshPromise, timeoutPromise]);
    } catch (error) {
      console.error("Refresh failed:", error);
      // Optional: Add toast here if desired, but console error is fine for now as per plan
    } finally {
      setRefreshing(false);
    }
  };

  const handleOpenBucketSettings = (bucketName: string) => {
    if (!activeAccount) return;
    navigate({
      to: "/accounts/$accountId/buckets/$bucketId/settings",
      params: { accountId: activeAccount.id, bucketId: bucketName },
    });
  };

  if (!activeAccount) {
    return null; // Should be handled by layout, but safe check
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
      <header className="border-b border-border/40 bg-gradient-to-br from-background via-background/80 to-background/40 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="font-mono">
                    {activeAccount.accessKeyPreview || "Unknown Key"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-96" align="start">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <h4 className="font-medium leading-none">{t("dashboard.credentialDetails")}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t("dashboard.credentialDetailsDesc")}
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-muted-foreground shrink-0">
                        {t("dashboard.label.endpoint")}
                      </span>
                      <span className="font-mono text-xs break-all text-right">
                        {activeAccount.endpoint}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("dashboard.label.ssl")}</span>
                      <span
                        className={activeAccount.useSSL ? "text-emerald-500" : "text-amber-500"}
                      >
                        {activeAccount.useSSL
                          ? t("dashboard.status.enabled")
                          : t("dashboard.status.disabled")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("dashboard.label.region")}</span>
                      <span>{activeAccount.region || t("dashboard.region.auto")}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("dashboard.label.port")}</span>
                      <span>{activeAccount.port || t("dashboard.label.default")}</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <div className="h-4 w-px bg-border/60 mx-1" />

            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground hover:text-foreground"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? t("dashboard.refreshing") : t("dashboard.refresh")}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!activeAccount}
              onClick={() => openDrawer("edit", activeAccount)}
            >
              {t("dashboard.editAccount")}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </header>

      <section className="flex-1 overflow-hidden p-0">
        <FileExplorer
          accountId={activeAccount.id}
          onOpenBucketSettings={handleOpenBucketSettings}
          className="h-full border-none rounded-none shadow-none bg-transparent"
        />
      </section>
    </main>
  );
}
