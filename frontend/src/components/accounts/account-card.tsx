import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AccountModel } from "@/state/accounts";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  MapPin,
  Pencil,
  Server,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { memo, MouseEvent } from "react";

export type AccountCardStatus = "ok" | "error" | "pending";

const statusStyles: Record<AccountCardStatus, { dot: string; pulse?: boolean; label: string }> = {
  ok: {
    dot: "bg-emerald-500",
    pulse: true,
    label: "连接正常",
  },
  error: {
    dot: "bg-red-500",
    label: "连接异常",
  },
  pending: {
    dot: "bg-muted",
    label: "未连接",
  },
};

type AccountCardProps = {
  account: AccountModel;
  status?: AccountCardStatus;
  statusMessage?: string;
  disabled?: boolean;
  onSelect?: (account: AccountModel) => void;
  onEdit?: (account: AccountModel) => void;
  onDelete?: (account: AccountModel) => void;
  layout?: "cards" | "list";
};

export const AccountCard = memo(function AccountCard({
  account,
  status = "pending",
  statusMessage,
  disabled,
  onSelect,
  onEdit,
  onDelete,
  layout = "cards",
}: AccountCardProps) {
  const navigate = useNavigate();
  const isList = layout === "list";

  const handleClick = () => {
    if (disabled) return;
    onSelect?.(account);
    navigate({
      to: "/accounts/$accountId/dashboard",
      params: { accountId: account.id },
    });
  };

  const handleEdit = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled) return;
    onEdit?.(account);
  };

  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled) return;
    onDelete?.(account);
  };

  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "group h-full w-full cursor-pointer rounded-2xl border border-border/40 bg-card/80 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        disabled && "pointer-events-none opacity-70",
      )}
    >
      <div className={cn("flex h-full flex-col gap-4", isList && "flex")}>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold leading-tight line-clamp-1">{account.name}</h3>
            <StatusIndicator
              status={status}
              statusMessage={statusMessage}
              layout={layout}
              compact
            />
            {account.tag ? (
              <Badge
                variant="outline"
                className="ml-auto rounded-full px-2 py-0 text-xs font-medium text-muted-foreground"
              >
                {account.tag}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-1">{account.providerLabel}</p>
        </div>

        <ul
          className={cn(
            "mt-2 grid gap-3 text-sm text-muted-foreground",
            isList ? "sm:grid-cols-3 sm:gap-x-6 sm:gap-y-1" : "grid-cols-1",
          )}
        >
          {isList ? (
            <>
              <DetailItem icon={Building2} label="Provider" value={account.providerLabel} />
              <DetailItem icon={MapPin} label="Region" value={account.region || "未设置"} />
              <DetailItem
                icon={ShieldCheck}
                label="SSL"
                value={account.useSSL ? "已启用" : "关闭"}
              />
              <DetailItem
                icon={Server}
                label="Endpoint"
                value={account.endpoint}
                className="sm:col-span-3"
              />
            </>
          ) : (
            <>
              <DetailItem icon={Building2} label="Provider" value={account.providerLabel} />
              <DetailItem icon={MapPin} label="Region" value={account.region || "未设置"} />
              <DetailItem
                icon={ShieldCheck}
                label="SSL"
                value={account.useSSL ? "已启用" : "关闭"}
              />
              <DetailItem icon={Server} label="Endpoint" value={account.endpoint} />
            </>
          )}
        </ul>

        <Separator className={cn("mt-1", !isList && "opacity-60")} />

        {(onEdit || onDelete) && (
          <div
            className={cn(
              "mt-auto flex items-end gap-2",
              isList ? "self-end sm:mt-0 sm:justify-end" : "justify-end",
            )}
          >
            {onEdit ? (
              <Button
                variant="outline"
                size={isList ? "sm" : "icon"}
                className={cn(
                  isList ? "gap-2 px-3" : "h-9 w-9 text-muted-foreground",
                  !isList && "rounded-full border-0 bg-transparent shadow-none",
                )}
                onClick={handleEdit}
                aria-label="编辑账户"
              >
                <Pencil className="h-4 w-4" />
                {isList ? <span>编辑</span> : null}
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                variant={isList ? "destructive" : "ghost"}
                size={isList ? "sm" : "icon"}
                className={cn(
                  isList ? "gap-2 px-3" : "h-9 w-9 text-destructive",
                  !isList && "rounded-full",
                )}
                onClick={handleDelete}
                aria-label="删除账户"
              >
                <Trash2 className="h-4 w-4" />
                {isList ? <span>删除</span> : null}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
});

const DetailItem = ({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  className?: string;
}) => (
  <li className={cn("flex min-w-0 items-center gap-2", className)}>
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span className="shrink-0 text-foreground/80">{label}:</span>
    <span className="truncate text-foreground" title={value}>
      {value}
    </span>
  </li>
);

const StatusIndicator = ({
  status,
  layout,
  compact,
  statusMessage,
}: {
  status: AccountCardStatus;
  layout: "cards" | "list";
  compact?: boolean;
  statusMessage?: string;
}) => {
  const meta = statusStyles[status];
  const tooltipContent = status === "error" && statusMessage ? statusMessage : undefined;
  const indicator = (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        !compact && layout === "list" && "sm:flex-col sm:items-end sm:gap-1",
      )}
      role="status"
      aria-live="polite"
      aria-label={meta.label}
    >
      <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center" aria-hidden>
        {meta.pulse ? (
          <span
            className="absolute inline-flex h-4 w-4 rounded-full bg-emerald-400/40 opacity-75 animate-ping"
            aria-hidden
          />
        ) : null}
        <span
          className={cn(
            "relative inline-flex h-2.5 w-2.5 rounded-full border border-background/60",
            meta.dot,
          )}
        />
      </span>
      <span
        className={cn("text-xs", compact ? "hidden" : layout === "cards" ? "hidden" : "sm:inline")}
      >
        {meta.label}
      </span>
    </div>
  );

  if (!tooltipContent) {
    return indicator;
  }

  return (
    <TooltipProvider delayDuration={150} disableHoverableContent>
      <Tooltip>
        <TooltipTrigger asChild>{indicator}</TooltipTrigger>
        <TooltipContent side="bottom" align="start" className="max-w-xs text-left text-destructive">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
