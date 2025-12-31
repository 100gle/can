import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AccountModel } from "@/state/accounts";
import { useNavigate } from "@tanstack/react-router";
import { Cloud, MapPin, Pencil, Server, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import { memo, MouseEvent, ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";

type AccountCardProps = {
  account: AccountModel;
  disabled?: boolean;
  onSelect?: (account: AccountModel) => void;
  onEdit?: (account: AccountModel) => void;
  onDelete?: (account: AccountModel) => void;
  layout?: "card" | "list";
};

type DetailItemData = {
  icon: LucideIcon;
  label: string;
  value: string;
  className?: string;
};

export const AccountCard = memo(function AccountCard({
  account,
  disabled,
  onSelect,
  onEdit,
  onDelete,
  layout = "card",
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

  const stopPropagation = (handler?: (account: AccountModel) => void) => {
    return (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (disabled) return;
      handler?.(account);
    };
  };

  const detailItems: DetailItemData[] = useMemo(
    () => [
      { icon: Cloud, label: t("account.card.provider"), value: account.providerLabel },
      {
        icon: MapPin,
        label: t("account.card.region"),
        value: account.region || t("account.card.regionNotSet"),
      },
      {
        icon: ShieldCheck,
        label: "SSL",
        value: account.useSSL ? t("account.card.sslEnabled") : t("account.card.sslDisabled"),
      },
      { icon: Server, label: "Endpoint", value: account.endpoint },
    ],
    [account, t],
  );

  const hasActions = onEdit || onDelete;

  return (
    <CardWrapper disabled={disabled} onClick={handleClick} variant={layout}>
      {isList ? (
        <div className="space-y-3">
          <AccountHeader name={account.name} tag={account.tag} variant="list" />
          <div className="flex items-start gap-6">
            <ul className="flex-1 grid grid-cols-3 gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {detailItems.map((item, idx) => (
                <DetailItem
                  key={item.label}
                  {...item}
                  className={idx === detailItems.length - 1 ? "col-span-3" : undefined}
                />
              ))}
            </ul>
            {hasActions && <Separator orientation="vertical" className="h-10 opacity-60" />}
            <AccountActions
              variant="list"
              onEdit={onEdit && stopPropagation(onEdit)}
              onDelete={onDelete && stopPropagation(onDelete)}
            />
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-4">
          <AccountHeader name={account.name} tag={account.tag} variant="card" />
          <ul className="mt-2 grid gap-3 text-sm text-muted-foreground grid-cols-1">
            {detailItems.map((item) => (
              <DetailItem key={item.label} {...item} />
            ))}
          </ul>
          <Separator className="mt-1" />
          <AccountActions
            variant="card"
            onEdit={onEdit && stopPropagation(onEdit)}
            onDelete={onDelete && stopPropagation(onDelete)}
          />
        </div>
      )}
    </CardWrapper>
  );
});

// --- Sub-components ---

const CardWrapper = ({
  disabled,
  onClick,
  variant,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  variant: "card" | "list";
  children: ReactNode;
}) => (
  <Card
    role="button"
    tabIndex={disabled ? -1 : 0}
    aria-disabled={disabled}
    onClick={onClick}
    className={cn(
      "group cursor-pointer rounded-lg border border-border/60 bg-card/80 text-left shadow-sm transition-all hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
      variant === "list"
        ? "w-full px-5 py-4 hover:shadow-lg"
        : "h-full w-full p-4 hover:-translate-y-0.5 hover:shadow-2xl",
      disabled && "pointer-events-none opacity-70",
    )}
  >
    {children}
  </Card>
);

const AccountHeader = ({
  name,
  tag,
  variant,
}: {
  name: string;
  tag?: string;
  variant: "card" | "list";
}) => (
  <div className={cn("min-w-0", variant === "card" && "space-y-1")}>
    <div className={cn("flex items-center gap-2", variant === "card" && "flex-wrap")}>
      <h3
        className={cn(
          "font-semibold leading-tight",
          variant === "list" ? "text-lg truncate" : "text-xl line-clamp-1",
        )}
      >
        {name}
      </h3>
      {tag && (
        <Badge
          variant="outline"
          className={cn(
            "rounded-full px-2 py-0 text-xs font-medium text-muted-foreground",
            variant === "list" && "shrink-0",
          )}
        >
          {tag}
        </Badge>
      )}
    </div>
  </div>
);

const AccountActions = ({
  variant,
  onEdit,
  onDelete,
}: {
  variant: "card" | "list";
  onEdit?: (event: MouseEvent<HTMLButtonElement>) => void;
  onDelete?: (event: MouseEvent<HTMLButtonElement>) => void;
}) => {
  const { t } = useTranslation("common");
  if (!onEdit && !onDelete) return null;

  if (variant === "list") {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 px-3"
            onClick={onEdit}
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
            onClick={onDelete}
            aria-label={t("common.deleteAria")}
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t("common.delete")}</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-auto flex items-end gap-2 justify-end">
      {onEdit && (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 text-muted-foreground rounded-full border-0 bg-transparent shadow-none"
          onClick={onEdit}
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
          onClick={onDelete}
          aria-label={t("account.card.deleteAria")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

const DetailItem = ({ icon: Icon, label, value, className }: DetailItemData) => (
  <li className={cn("flex min-w-0 items-center gap-2", className)}>
    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <span className="shrink-0 text-foreground/80">{label}:</span>
    <span className="truncate text-foreground" title={value}>
      {value}
    </span>
  </li>
);
