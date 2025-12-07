import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BucketSecurityStatus } from "@/state/security";
import { Link } from "@tanstack/react-router";
import { FolderOpen, Globe, Loader2, Lock, Shield } from "lucide-react";
import { EncryptionBadge, SecurityStatusBadge, VersioningBadge } from "./security-badges";

interface SecurityStatusCardProps {
  status: BucketSecurityStatus;
  accountId: string;
}

export function SecurityStatusCard({ status, accountId }: SecurityStatusCardProps) {
  if (status.loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status.error) {
    return (
      <Card className="relative overflow-hidden border-red-200 dark:border-red-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-medium">{status.bucketName}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{status.error}</p>
        </CardContent>
      </Card>
    );
  }

  const severityBorderColors = {
    critical: "border-l-red-500",
    warning: "border-l-amber-500",
    info: "border-l-blue-500",
    pass: "border-l-emerald-500",
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-l-4 transition-all hover:shadow-md",
        severityBorderColors[status.overallScore],
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
            <CardTitle className="text-base font-medium truncate">{status.bucketName}</CardTitle>
          </div>
          <SecurityStatusBadge severity={status.overallScore} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Security Status Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Encryption */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              加密
            </div>
            <EncryptionBadge
              enabled={status.encryption.enabled}
              algorithm={status.encryption.algorithm}
            />
          </div>

          {/* Versioning */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              版本控制
            </div>
            <VersioningBadge status={status.versioning.status} />
          </div>

          {/* Policy */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              访问策略
            </div>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                status.policy.hasPublicAccess
                  ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30"
                  : status.policy.hasPolicy
                    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30"
                    : "text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800",
              )}
            >
              {status.policy.hasPublicAccess
                ? "公开访问"
                : status.policy.hasPolicy
                  ? "已配置"
                  : "默认"}
            </span>
          </div>

          {/* CORS */}
          {status.cors.hasRules && (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">CORS</div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30">
                {status.cors.ruleCount} 条规则
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" className="w-full" asChild>
            <Link
              to="/accounts/$accountId/buckets/$bucketId/settings"
              params={{ accountId, bucketId: status.bucketName }}
            >
              查看详情
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
