import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AccountModel } from "@/state/accounts";
import { useNavigate } from "@tanstack/react-router";
import { Cloud, MapPin, Pencil, Server, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import { memo, MouseEvent } from "react";
import { useTranslation } from "react-i18next";

type AccountCardProps = {
  account: AccountModel;
  disabled?: boolean;
  onSelect?: (account: AccountModel) => void;
  onEdit?: (account: AccountModel) => void;
  onDelete?: (account: AccountModel) => void;
  layout?: "cards" | "list";
};

export const AccountCard = memo(function AccountCard({
  account,
  disabled,
  onSelect,
  onEdit,
  onDelete,
  layout = "cards",
}: AccountCardProps) {
  const { t } = useTranslation("common");
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

  // 列表模式：三行布局
  // 第一行：Account Name + Tag
  // 第二三行：左侧属性网格（3x2） + 右侧 actions
  if (isList) {
    return (
      <Card
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={handleClick}
        className={cn(
          "group w-full cursor-pointer rounded-lg border border-border/40 bg-card/80 px-5 py-4 text-left transition-all hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          disabled && "pointer-events-none opacity-70",
        )}
      >
        <div className="space-y-3">
          {/* 第一行：Account Name + Tag */}
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold leading-tight truncate">{account.name}</h3>
            {account.tag && (
              <Badge
                variant="outline"
                className="shrink-0 rounded-full px-2 py-0 text-xs font-medium text-muted-foreground"
              >
                {account.tag}
              </Badge>
            )}
          </div>

          {/* 第二三行：属性网格 + Actions */}
          <div className="flex items-center gap-6">
            {/* 左侧：属性网格 3x2 */}
            <ul className="flex-1 grid grid-cols-3 gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <DetailItem
                icon={Cloud}
                label={t("account.card.provider")}
                value={account.providerLabel}
              />
              <DetailItem
                icon={MapPin}
                label={t("account.card.region")}
                value={account.region || t("account.card.regionNotSet")}
              />
              <DetailItem
                icon={ShieldCheck}
                label="SSL"
                value={
                  account.useSSL ? t("account.card.sslEnabled") : t("account.card.sslDisabled")
                }
              />
              <DetailItem
                icon={Server}
                label="Endpoint"
                value={account.endpoint}
                className="col-span-3"
              />
            </ul>

            {/* 分隔线 */}
            {(onEdit || onDelete) && (
              <Separator orientation="vertical" className="h-10 opacity-60" />
            )}

            {/* 右侧：操作按钮 */}
            {(onEdit || onDelete) && (
              <div className="flex shrink-0 items-center gap-2">
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 px-3"
                    onClick={handleEdit}
                    aria-label={t("account.card.editAria")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>{t("account.card.edit")}</span>
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 px-3"
                    onClick={handleDelete}
                    aria-label={t("account.card.deleteAria")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{t("account.card.delete")}</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // 卡片模式
  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "group h-full w-full cursor-pointer rounded-lg border border-border/40 bg-card/80 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        disabled && "pointer-events-none opacity-70",
      )}
    >
      <div className="flex h-full flex-col gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold leading-tight line-clamp-1">{account.name}</h3>
            {account.tag && (
              <Badge
                variant="outline"
                className="rounded-full px-2 py-0 text-xs font-medium text-muted-foreground"
              >
                {account.tag}
              </Badge>
            )}
          </div>
        </div>

        <ul className="mt-2 grid gap-3 text-sm text-muted-foreground grid-cols-1">
          <DetailItem
            icon={Cloud}
            label={t("account.card.provider")}
            value={account.providerLabel}
          />
          <DetailItem
            icon={MapPin}
            label={t("account.card.region")}
            value={account.region || t("account.card.regionNotSet")}
          />
          <DetailItem
            icon={ShieldCheck}
            label="SSL"
            value={account.useSSL ? t("account.card.sslEnabled") : t("account.card.sslDisabled")}
          />
          <DetailItem icon={Server} label="Endpoint" value={account.endpoint} />
        </ul>

        <Separator className="mt-1" />

        {(onEdit || onDelete) && (
          <div className="mt-auto flex items-end gap-2 justify-end">
            {onEdit && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 text-muted-foreground rounded-full border-0 bg-transparent shadow-none"
                onClick={handleEdit}
                aria-label={t("account.card.editAria")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive rounded-full"
                onClick={handleDelete}
                aria-label={t("account.card.deleteAria")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
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
