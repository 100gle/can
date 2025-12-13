import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type ConnectionStatus = "ok" | "error" | "pending" | "connecting";

const CONNECTION_CHECK_INTERVAL = 30_000; // 30 seconds

export const AccountSwitcher = () => {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const accounts = useAccountsStore((state) => state.accounts);
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const connectionTests = useAccountsStore((state) => state.connectionTests);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const lastCheckRef = useRef<number>(0);

  // Periodic connection check for active account only
  useEffect(() => {
    if (!activeAccountId) return;

    const checkConnection = () => {
      const probe = connectionTests[activeAccountId];
      const now = Date.now();

      // Skip if already ok and checked recently (within 30 seconds)
      if (probe?.status === "ok" && probe.checkedAt) {
        const elapsed = now - new Date(probe.checkedAt).getTime();
        if (elapsed < CONNECTION_CHECK_INTERVAL) {
          return;
        }
      }

      // Skip if currently running
      if (probe?.status === "running") return;

      lastCheckRef.current = now;
      void accountsStore.testConnection(activeAccountId).catch(() => undefined);
    };

    // Initial check
    checkConnection();

    // Set up periodic check
    const timer = setInterval(checkConnection, CONNECTION_CHECK_INTERVAL);

    return () => clearInterval(timer);
  }, [activeAccountId, connectionTests]);

  const getStatus = (accountId: string): ConnectionStatus => {
    if (pendingAccountId === accountId) return "connecting";
    const probe = connectionTests[accountId];
    if (!probe || probe.status === "idle") return "pending";
    if (probe.status === "running") return "connecting";
    if (probe.status === "ok") return "ok";
    if (probe.status === "error") return "error";
    return "pending";
  };

  const getStatusMessage = (accountId: string): string | undefined => {
    const probe = connectionTests[accountId];
    return probe?.message;
  };

  const handleSelect = async (accountId: string) => {
    if (pendingAccountId) return;

    // If clicking currently active account, just navigate
    if (activeAccountId === accountId) {
      navigate({
        to: "/accounts/$accountId/dashboard",
        params: { accountId },
      });
      return;
    }

    // Navigate immediately for responsive UX
    navigate({
      to: "/accounts/$accountId/dashboard",
      params: { accountId },
    });

    // Set active account in background (route will handle if not ready)
    setPendingAccountId(accountId);
    try {
      await accountsStore.setActiveAccount(accountId);
    } finally {
      setPendingAccountId(null);
    }

    // Test connection in background
    void accountsStore.testConnection(accountId).catch((error) => {
      const description = error instanceof Error ? error.message : t("account.switcher.testFailed");
      toast.error(t("account.switcher.testFailed"), { description });
    });
  };

  const statusConfig: Record<ConnectionStatus, { dot: string; pulse?: boolean; label: string }> = {
    ok: { dot: "bg-emerald-500", pulse: true, label: t("account.status.ok") },
    error: { dot: "bg-red-500", label: t("account.status.error") },
    pending: { dot: "bg-muted-foreground/50", label: t("account.switcher.idle") },
    connecting: { dot: "bg-amber-500", pulse: true, label: t("account.switcher.connecting") },
  };

  if (!accounts.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
        <p>{t("account.switcher.noAccounts")}</p>
        <p>{t("account.switcher.createHint")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {accounts.map((account) => {
        const isActive = activeAccountId === account.id;
        const isSwitching = pendingAccountId === account.id;
        const isDisabled = !!pendingAccountId && pendingAccountId !== account.id;
        // Only show status for active account
        const status = isActive ? getStatus(account.id) : null;
        const statusMessage = isActive ? getStatusMessage(account.id) : undefined;
        const meta = status ? statusConfig[status] : null;

        return (
          <Button
            key={account.id}
            variant="ghost"
            onClick={() => handleSelect(account.id)}
            disabled={isDisabled}
            className={cn(
              "w-full rounded-lg px-4 py-3 gap-1 h-auto text-left justify-start flex-col items-start relative",
              isActive && "border border-primary/70 bg-primary/10",
              isDisabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <div className="flex items-baseline gap-1 w-full">
              <p className="text-sm font-semibold text-foreground">{account.name}</p>
              {/* Connection Status Indicator - only for active account */}
              {(isSwitching || isActive) &&
                (isSwitching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                ) : (
                  meta && (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="relative inline-flex h-2.5 w-2.5 items-center justify-center"
                            aria-label={meta.label}
                          >
                            {meta.pulse && (
                              <span
                                className={cn(
                                  "absolute inline-flex h-4 w-4 rounded-full opacity-75 animate-ping",
                                  status === "ok" && "bg-emerald-400/40",
                                  status === "connecting" && "bg-amber-400/40",
                                )}
                                aria-hidden
                              />
                            )}
                            <span
                              className={cn(
                                "relative inline-flex h-2.5 w-2.5 rounded-full border border-background/60",
                                meta.dot,
                              )}
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">
                          {status === "error" && statusMessage ? statusMessage : meta.label}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                ))}
              {/* Tag badge */}
              {account.tag && (
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto text-[10px] px-1.5 py-0 h-5 rounded-full font-medium text-muted-foreground/80 border-border/60",
                    isActive && "bg-background/50 text-foreground/80 border-primary/20",
                  )}
                >
                  {account.tag}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{account.providerLabel}</p>
          </Button>
        );
      })}
    </div>
  );
};
