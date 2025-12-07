import { cn } from "@/lib/utils";
import type { SecuritySeverity } from "@/state/security";
import { Lock, LockOpen, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

interface SecurityStatusBadgeProps {
  severity: SecuritySeverity;
  label?: string;
  className?: string;
}

const severityConfig: Record<
  SecuritySeverity,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  critical: {
    icon: ShieldAlert,
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-100 dark:bg-red-900/30",
    label: "严重",
  },
  warning: {
    icon: ShieldQuestion,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    label: "警告",
  },
  info: {
    icon: ShieldCheck,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    label: "信息",
  },
  pass: {
    icon: ShieldCheck,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    label: "通过",
  },
};

export function SecurityStatusBadge({ severity, label, className }: SecurityStatusBadgeProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.color,
        config.bg,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label ?? config.label}
    </span>
  );
}

interface EncryptionBadgeProps {
  enabled: boolean;
  algorithm?: string;
  className?: string;
}

export function EncryptionBadge({ enabled, algorithm, className }: EncryptionBadgeProps) {
  if (enabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
          className,
        )}
      >
        <Lock className="h-3.5 w-3.5" />
        {algorithm || "SSE"}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30",
        className,
      )}
    >
      <LockOpen className="h-3.5 w-3.5" />
      未加密
    </span>
  );
}

interface VersioningBadgeProps {
  status: string;
  className?: string;
}

export function VersioningBadge({ status, className }: VersioningBadgeProps) {
  const isEnabled = status === "Enabled";
  const isSuspended = status === "Suspended";

  if (isEnabled) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
          className,
        )}
      >
        已启用
      </span>
    );
  }

  if (isSuspended) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
          "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
          className,
        )}
      >
        已暂停
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800",
        className,
      )}
    >
      未启用
    </span>
  );
}
