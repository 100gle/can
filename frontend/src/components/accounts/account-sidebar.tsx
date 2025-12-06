import logo from "@/assets/images/logo-universal.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccountModel, ProviderMetadata } from "@/state/accounts";
import { Moon, Server, Sun } from "lucide-react";

export type AccountSidebarProps = {
  accounts: AccountModel[];
  providers: ProviderMetadata[];
  activeAccountId?: string;
  loading: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onSelectAccount: (account: AccountModel) => void;
};

export const AccountSidebar = ({
  accounts,
  providers,
  activeAccountId,
  loading,
  isDark,
  onToggleTheme,
  onSelectAccount,
}: AccountSidebarProps) => {
  return (
    <aside className="hidden w-[320px] flex-col border-r border-border/40 bg-sidebar/40 p-6 backdrop-blur-xl xl:flex">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="logo" className="h-10 w-10 rounded-lg bg-secondary/40 p-1.5" />
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Nebula</p>
            <h1 className="text-xl font-semibold">Object Studio</h1>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onToggleTheme} aria-label="切换主题">
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>

      <div className="mt-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">支持的服务商</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {providers.map((provider) => (
            <Badge key={provider.id} variant="outline">
              {provider.label}
            </Badge>
          ))}
          {!providers.length ? <Badge variant="outline">加载中...</Badge> : null}
        </div>
      </div>

      <div className="mt-8 flex-1 overflow-hidden">
        <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
          <span>账户</span>
          <span>{accounts.length}</span>
        </div>
        <div className="mt-3 space-y-3 overflow-y-auto pr-2">
          {accounts.map((account) => (
            <SidebarAccountItem
              key={account.id}
              account={account}
              active={activeAccountId === account.id}
              loading={loading}
              onSelect={onSelectAccount}
            />
          ))}
          {!accounts.length ? (
            <Card className="border-dashed text-sm text-muted-foreground">
              <p>尚未配置账户。</p>
              <p className="mt-1">通过“新建账户”按钮即可接入 AWS / OSS / COS / R2。</p>
            </Card>
          ) : null}
        </div>
      </div>
    </aside>
  );
};

const SidebarAccountItem = ({
  account,
  active,
  loading,
  onSelect,
}: {
  account: AccountModel;
  active: boolean;
  loading: boolean;
  onSelect: (account: AccountModel) => void;
}) => (
  <Button
    variant="ghost"
    onClick={() => onSelect(account)}
    disabled={loading}
    className={cn(
      "w-full rounded-lg h-auto p-4 text-left justify-start flex-col items-stretch",
      active && "border border-primary/60 bg-primary/10",
    )}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="font-medium">{account.name}</p>
        <p className="text-xs text-muted-foreground">
          {account.providerLabel} · {account.region || "Region 未设置"}
        </p>
      </div>
      {active ? <Badge variant="success">Active</Badge> : null}
    </div>
    <div className="mt-3 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <Server className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span className="shrink-0 text-foreground/80">Endpoint:</span>
      <span className="truncate text-foreground">{account.endpoint}</span>
    </div>
  </Button>
);
