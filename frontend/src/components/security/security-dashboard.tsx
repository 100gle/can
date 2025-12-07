import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { bucketsStore, useBucketsStore } from "@/state/buckets";
import { securityStore, useSecurityStore, type SecurityCheckResult } from "@/state/security";
import { EnableBucketVersioning, SetBucketEncryption } from "@wailsjs/go/app/App";
import { config } from "@wailsjs/go/models";
import { Loader2, Play, RefreshCw, Shield, ShieldCheck } from "lucide-react";
import { useEffect, useMemo } from "react";
import { SecurityCheckResults } from "./security-check-results";
import { SecurityStatusCard } from "./security-status-card";

interface SecurityDashboardProps {
  accountId: string;
}

export function SecurityDashboard({ accountId }: SecurityDashboardProps) {
  const { buckets, loading: bucketsLoading } = useBucketsStore((state) => state);
  const { bucketStatuses, checkResults, isScanning, scanProgress, scanTotal } = useSecurityStore(
    (state) => state,
  );

  const bucketNames = useMemo(() => buckets.map((b) => b.name), [buckets]);

  // Load buckets on mount
  useEffect(() => {
    void bucketsStore.loadBuckets(accountId);
  }, [accountId]);

  // Load security status for all buckets
  useEffect(() => {
    if (bucketNames.length > 0) {
      void securityStore.loadAllBucketsSecurityStatus(accountId, bucketNames);
    }
  }, [accountId, bucketNames]);

  const handleRunSecurityCheck = () => {
    if (bucketNames.length > 0) {
      void securityStore.runSecurityCheck(accountId, bucketNames);
    }
  };

  const handleRefresh = () => {
    if (bucketNames.length > 0) {
      void securityStore.loadAllBucketsSecurityStatus(accountId, bucketNames);
    }
  };

  const handleAutoFix = async (result: SecurityCheckResult) => {
    try {
      if (result.checkType === "versioning") {
        await EnableBucketVersioning(accountId, result.bucketName);
        console.log(`已为 ${result.bucketName} 启用版本控制`);
      } else if (result.checkType === "encryption") {
        const encryption = new config.BucketEncryption({
          enabled: true,
          algorithm: "AES256",
          kmsKeyId: "",
          updated: new Date().toISOString(),
        });
        await SetBucketEncryption(accountId, result.bucketName, encryption);
        console.log(`已为 ${result.bucketName} 启用默认加密`);
      }
      // Refresh the status
      await securityStore.loadBucketSecurityStatus(accountId, result.bucketName);
      // Re-run check for this bucket
      await securityStore.runSecurityCheck(accountId, [result.bucketName]);
    } catch (error) {
      console.error(`自动修复失败: ${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  // Security score summary
  const statusArray = Array.from(bucketStatuses.values());
  const criticalCount = statusArray.filter((s) => s.overallScore === "critical").length;
  const warningCount = statusArray.filter((s) => s.overallScore === "warning").length;
  const passCount = statusArray.filter((s) => s.overallScore === "pass").length;

  if (bucketsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bucketNames.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">暂无存储桶</h3>
          <p className="text-muted-foreground">创建存储桶后即可查看安全状态</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            安全概览
          </h2>
          <p className="text-sm text-muted-foreground mt-1">查看所有存储桶的安全配置状态</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isScanning}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button size="sm" onClick={handleRunSecurityCheck} disabled={isScanning}>
            <Play className="h-4 w-4 mr-2" />
            运行安全检查
          </Button>
        </div>
      </div>

      {/* Scanning Progress */}
      {isScanning && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>正在扫描存储桶...</span>
                  <span className="text-muted-foreground">
                    {scanProgress} / {scanTotal}
                  </span>
                </div>
                <Progress value={(scanProgress / scanTotal) * 100} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={criticalCount > 0 ? "border-red-200 dark:border-red-800" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>严重问题</CardDescription>
            <CardTitle
              className={`text-3xl ${criticalCount > 0 ? "text-red-600 dark:text-red-400" : ""}`}
            >
              {criticalCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={warningCount > 0 ? "border-amber-200 dark:border-amber-800" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>警告</CardDescription>
            <CardTitle
              className={`text-3xl ${warningCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}
            >
              {warningCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={passCount > 0 ? "border-emerald-200 dark:border-emerald-800" : ""}>
          <CardHeader className="pb-2">
            <CardDescription>安全通过</CardDescription>
            <CardTitle
              className={`text-3xl ${passCount > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            >
              {passCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Bucket Status Grid */}
      <div>
        <h3 className="text-lg font-medium mb-4">存储桶安全状态</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bucketNames.map((name) => {
            const status = bucketStatuses.get(name);
            if (!status) {
              return (
                <Card key={name} className="animate-pulse">
                  <CardContent className="py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            }
            return <SecurityStatusCard key={name} status={status} accountId={accountId} />;
          })}
        </div>
      </div>

      {/* Check Results */}
      {checkResults.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">详细检查结果</h3>
          <SecurityCheckResults results={checkResults} onAutoFix={handleAutoFix} />
        </div>
      )}
    </div>
  );
}
