import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { accountsStore, useAccountsStore } from "@/state/accounts";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

export const AccountSwitcher = () => {
  const navigate = useNavigate();
  const accounts = useAccountsStore((state) => state.accounts);
  const activeAccountId = useAccountsStore((state) => state.activeAccountId);
  const loading = useAccountsStore((state) => state.loading);

  const handleSelect = async (accountId: string) => {
    await accountsStore.setActiveAccount(accountId);
    navigate({
      to: "/accounts/$accountId/dashboard",
      params: { accountId },
    });
  };

  if (!accounts.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
        <p>暂无账户</p>
        <p>从首页或顶部按钮创建一个账户。</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {accounts.map((account) => (
        <Button
          key={account.id}
          variant="ghost"
          onClick={() => handleSelect(account.id)}
          className={cn(
            "w-full rounded-lg px-4 py-3 h-auto text-left justify-start flex-col items-start",
            activeAccountId === account.id && "border border-primary/70 bg-primary/10",
          )}
        >
          <p className="text-sm font-semibold text-foreground">{account.name}</p>
          <p className="text-xs text-muted-foreground">{account.providerLabel}</p>
        </Button>
      ))}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在同步账户列表...
        </div>
      ) : null}
    </div>
  );
};
