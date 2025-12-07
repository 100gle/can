import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { SecurityCheckResult, SecuritySeverity } from "@/state/security";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Wrench,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { SecurityStatusBadge } from "./security-badges";

interface SecurityCheckResultItemProps {
  result: SecurityCheckResult;
  onAutoFix?: (result: SecurityCheckResult) => void;
}

const severityIcons: Record<SecuritySeverity, React.ElementType> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
  pass: CheckCircle2,
};

export function SecurityCheckResultItem({ result, onAutoFix }: SecurityCheckResultItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = severityIcons[result.severity];

  const severityColors = {
    critical: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    info: "text-blue-600 dark:text-blue-400",
    pass: "text-emerald-600 dark:text-emerald-400",
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "rounded-lg border p-4 transition-colors",
          result.severity === "critical" &&
            "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10",
          result.severity === "warning" &&
            "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10",
          result.severity === "info" &&
            "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10",
          result.severity === "pass" &&
            "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10",
        )}
      >
        <CollapsibleTrigger asChild>
          <div className="flex items-start justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", severityColors[result.severity])} />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm">{result.title}</h4>
                  <span className="text-xs text-muted-foreground">({result.bucketName})</span>
                </div>
                <p className="text-sm text-muted-foreground">{result.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SecurityStatusBadge severity={result.severity} />
              {result.recommendation &&
                (isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ))}
            </div>
          </div>
        </CollapsibleTrigger>

        {result.recommendation && (
          <CollapsibleContent>
            <div className="mt-4 pt-4 border-t border-dashed space-y-3">
              <div className="flex items-start gap-2">
                <Wrench className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="space-y-1">
                  <h5 className="text-xs font-medium text-muted-foreground">修复建议</h5>
                  <p className="text-sm">{result.recommendation}</p>
                </div>
              </div>
              {result.canAutoFix && onAutoFix && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-6"
                  onClick={() => onAutoFix(result)}
                >
                  自动修复
                </Button>
              )}
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}

interface SecurityCheckResultsProps {
  results: SecurityCheckResult[];
  onAutoFix?: (result: SecurityCheckResult) => void;
}

export function SecurityCheckResults({ results, onAutoFix }: SecurityCheckResultsProps) {
  // Group by severity
  const critical = results.filter((r) => r.severity === "critical");
  const warning = results.filter((r) => r.severity === "warning");
  const info = results.filter((r) => r.severity === "info");
  const pass = results.filter((r) => r.severity === "pass");

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Info className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">点击"运行安全检查"开始扫描</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">检查结果摘要</CardTitle>
          <CardDescription>共检查 {results.length} 项配置</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {critical.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {critical.length} 个严重问题
                </span>
              </div>
            )}
            {warning.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {warning.length} 个警告
                </span>
              </div>
            )}
            {info.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Info className="h-4 w-4 text-blue-500" />
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {info.length} 条信息
                </span>
              </div>
            )}
            {pass.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {pass.length} 项通过
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Critical Issues */}
      {critical.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            严重问题 ({critical.length})
          </h3>
          <div className="space-y-2">
            {critical.map((result) => (
              <SecurityCheckResultItem key={result.id} result={result} onAutoFix={onAutoFix} />
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warning.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            警告 ({warning.length})
          </h3>
          <div className="space-y-2">
            {warning.map((result) => (
              <SecurityCheckResultItem key={result.id} result={result} onAutoFix={onAutoFix} />
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      {info.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Info className="h-4 w-4" />
            信息 ({info.length})
          </h3>
          <div className="space-y-2">
            {info.map((result) => (
              <SecurityCheckResultItem key={result.id} result={result} onAutoFix={onAutoFix} />
            ))}
          </div>
        </div>
      )}

      {/* Passed */}
      {pass.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            已通过 ({pass.length})
          </h3>
          <div className="space-y-2">
            {pass.map((result) => (
              <SecurityCheckResultItem key={result.id} result={result} onAutoFix={onAutoFix} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
