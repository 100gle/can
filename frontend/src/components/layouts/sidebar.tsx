import logo from "@/assets/images/logo-universal.png";
import { AccountSwitcher } from "@/components/accounts/account-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAccountsStore } from "@/state/accounts";
import { useTransferStats } from "@/state/transfers";
import { useNavigate } from "@tanstack/react-router";
import { HelpCircle, Plus, Settings, Share2 } from "lucide-react";

type SidebarProps = {
  onCreateAccount?: () => void;
  accountId?: string;
};

export const Sidebar = ({ onCreateAccount, accountId }: SidebarProps) => {
  const navigate = useNavigate();
  const { activeAccountId } = useAccountsStore((state) => state);
  const currentAccountId = accountId || activeAccountId;
  const { active, failed, total } = useTransferStats();

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6">
      <Button
        variant="ghost"
        onClick={() => navigate({ to: "/" })}
        className="flex items-center gap-3 rounded-xl p-2 h-auto justify-start"
        aria-label="返回首页"
      >
        <img
          src={logo}
          alt="logo"
          className="h-10 w-10 rounded-xl border border-border/40 bg-background/70 p-1.5"
        />
        <div className="text-left">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">CAN</p>
          <p className="text-sm font-semibold">Object Studio</p>
        </div>
      </Button>
      <div className="flex-1 overflow-y-auto pr-1">
        <p className="px-2 text-xs uppercase tracking-widest text-muted-foreground">我的账户</p>
        <div className="mt-3 space-y-2">
          <AccountSwitcher />
        </div>
      </div>
      <div className="space-y-2">
        <Button size="sm" className="w-full gap-2" onClick={onCreateAccount}>
          <Plus className="h-4 w-4" />
          新建账户
        </Button>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => navigate({ to: "/transfers" })}
          >
            <Share2 className="h-4 w-4" />
            传输队列
          </Button>
          {total > 0 && (
            <Badge
              variant={failed > 0 ? null : active > 0 ? "default" : "outline"}
              className={cn(
                "absolute -top-2 -right-2 h-5 min-w-5 px-1.5 text-xs flex items-center justify-center",
                failed > 0 && "border-red-500/50 bg-red-500/90 text-white hover:bg-red-500",
              )}
            >
              {active > 0 ? active : total}
            </Badge>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={() => navigate({ to: "/settings" })}
        >
          <Settings className="h-4 w-4" />
          系统设置
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="w-full gap-2"
          onClick={() => navigate({ to: "/help" })}
        >
          <HelpCircle className="h-4 w-4" />
          帮助与支持
        </Button>
      </div>
    </div>
  );
};
