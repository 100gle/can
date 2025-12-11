import { cn } from "@/lib/utils";
import type { ConnectionProbe } from "@/state/accounts";
import { Loader2 } from "lucide-react";

type Status = "ok" | "error" | "pending" | "running";

const STATUS_META: Record<
  Exclude<Status, "running">,
  { label: string; dot: string; text: string }
> = {
  ok: { label: "连接正常", dot: "bg-emerald-500", text: "text-emerald-600" },
  error: { label: "连接异常", dot: "bg-red-500", text: "text-destructive" },
  pending: { label: "等待检测", dot: "bg-muted-foreground/60", text: "text-muted-foreground" },
};

const deriveStatus = (probe?: ConnectionProbe): Status => {
  if (!probe || probe.status === "idle") {
    return "pending";
  }
  if (probe.status === "running") {
    return "running";
  }
  if (probe.status === "error") {
    return "error";
  }
  return "ok";
};

type AccountStatusBadgeProps = {
  probe?: ConnectionProbe;
  className?: string;
};

export const AccountStatusBadge = ({ probe, className }: AccountStatusBadgeProps) => {
  const status = deriveStatus(probe);
  if (status === "running") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-amber-600", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        检测中...
      </span>
    );
  }

  const meta = STATUS_META[status];
  if (!meta) return null;

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", meta.text, className)}
    >
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
};
