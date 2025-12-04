import { useNavigate } from "@tanstack/react-router";
import { memo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AccountModel } from "@/state/accounts";

export type AccountCardStatus = "ok" | "error" | "pending";

const statusStyles: Record<AccountCardStatus, { dot: string; label: string; caption: string }> = {
  ok: {
    dot: "bg-emerald-400",
    label: "text-emerald-600",
    caption: "连接正常",
  },
  error: {
    dot: "bg-red-400",
    label: "text-red-600",
    caption: "连接异常",
  },
  pending: {
    dot: "bg-muted",
    label: "text-muted-foreground",
    caption: "等待测试",
  },
};

type AccountCardProps = {
  account: AccountModel;
  status?: AccountCardStatus;
  disabled?: boolean;
  onSelect?: (account: AccountModel) => void;
};

export const AccountCard = memo(function AccountCard({
  account,
  status = "pending",
  disabled,
  onSelect,
}: AccountCardProps) {
  const navigate = useNavigate();
  const statusMeta = statusStyles[status];

  const handleClick = () => {
    if (disabled) return;
    onSelect?.(account);
    navigate({
      to: "/accounts/$accountId/dashboard",
      params: { accountId: account.id },
    });
  };

  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "h-full cursor-pointer rounded-2xl border border-border/40 bg-card/70 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        disabled && "pointer-events-none opacity-70",
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">账户</p>
          <h3 className="mt-1 text-xl font-semibold">{account.name}</h3>
          <p className="text-sm text-muted-foreground">{account.providerLabel}</p>
        </div>
        <span className="flex items-center gap-1 text-xs">
          <span className={cn("h-2.5 w-2.5 rounded-full", statusMeta.dot)} aria-hidden />
          <span className={statusMeta.label}>{statusMeta.caption}</span>
        </span>
      </div>
      <dl className="mt-6 space-y-3 text-xs text-muted-foreground">
        <div className="space-y-1">
          <dt className="font-medium text-foreground/80">Endpoint</dt>
          <dd className="truncate">{account.endpoint}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Region</dt>
          <dd>{account.region || "未设置"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>SSL</dt>
          <dd>{account.useSSL ? "已启用" : "关闭"}</dd>
        </div>
      </dl>
    </Card>
  );
});
