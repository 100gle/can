import { PageHeader } from "@/components/layouts/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CancelMigrationJob,
  CreateMigrationJob,
  GetMigrationJob,
  ListAccounts,
  StartMigrationJob,
} from "@wailsjs/go/app/App";
import { accounts, migration } from "@wailsjs/go/models";
import { AlertCircle, Ban, CheckCircle, Loader2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function MigrationWizard() {
  const [step, setStep] = useState(1);
  const [accountsList, setAccountsList] = useState<accounts.Account[]>([]);

  // Form State
  const [sourceId, setSourceId] = useState("");
  const [sourceBucket, setSourceBucket] = useState("");
  const [sourcePrefix, setSourcePrefix] = useState("");

  const [destId, setDestId] = useState("");
  const [destBucket, setDestBucket] = useState("");
  const [destPrefix, setDestPrefix] = useState("");

  const [deleteSource, setDeleteSource] = useState(false);
  const [overwrite, setOverwrite] = useState(false);

  // Job State
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("");
  const [stats, setStats] = useState<migration.MigrationStats | null>(null);
  const [error, setError] = useState("");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Polling ref
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadAccounts();
    return () => {
      // Cleanup polling on unmount
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Start polling when step 3 is entered
  useEffect(() => {
    if (step === 3 && jobId) {
      startPolling();
    }
    return () => stopPolling();
  }, [step, jobId]);

  const startPolling = () => {
    stopPolling(); // Clear any existing interval

    // Poll immediately once
    pollJobStatus();

    // Then poll every 2 seconds
    pollingRef.current = setInterval(pollJobStatus, 2000);
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const pollJobStatus = async () => {
    if (!jobId) return;
    try {
      const job = await GetMigrationJob(jobId);
      if (job) {
        setStatus(job.status);
        setStats(job.stats);
        setError(job.error || "");

        // Stop polling when job completes
        if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
          stopPolling();
        }
      }
    } catch (err) {
      console.error("Failed to poll job status:", err);
    }
  };

  const loadAccounts = async () => {
    try {
      const accs = await ListAccounts();
      setAccountsList(accs);
    } catch {
      setGlobalError("Failed to load accounts");
    }
  };

  const handleCreateJob = async () => {
    setGlobalError(null);
    if (!sourceId || !sourceBucket || !destId || !destBucket) {
      setGlobalError("请填写所有必填字段");
      return;
    }

    try {
      // Construct inputs matching Go structs
      const source: migration.EndpointInfo = {
        account_id: sourceId,
        bucket_name: sourceBucket,
        prefix: sourcePrefix,
      };
      const dest: migration.EndpointInfo = {
        account_id: destId,
        bucket_name: destBucket,
        prefix: destPrefix,
      };
      const options: migration.MigrationOptions = {
        delete_source: deleteSource,
        overwrite: overwrite,
        max_concurrency: 5,
      };

      const job = await CreateMigrationJob(source, dest, options);
      setJobId(job.id);
      setStatus(job.status);
      setStats(job.stats);
      setStep(3);

      // Auto start
      await StartMigrationJob(job.id);
      setStatus("running");
    } catch (err) {
      console.error(err);
      setGlobalError("创建迁移任务失败");
    }
  };

  const confirmCancel = async () => {
    if (!jobId) return;
    setGlobalError(null);
    try {
      await CancelMigrationJob(jobId);
      setStatus("cancelled");
      stopPolling();
    } catch (err) {
      setGlobalError("取消失败: " + String(err));
    } finally {
      setCancelConfirmOpen(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setJobId("");
    setStatus("");
    setStats(null);
    setError("");
    setGlobalError(null);
    stopPolling();
  };

  const getProgressPercent = () => {
    if (!stats || !stats.total_objects || stats.total_objects === 0) return 0;
    return Math.round((stats.processed_objects / stats.total_objects) * 100);
  };

  const getStatusBadge = () => {
    switch (status) {
      case "running":
        return (
          <Badge variant="default" className="bg-blue-600">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            运行中
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            已完成
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="default" className="bg-red-600">
            <XCircle className="h-3 w-3 mr-1" />
            失败
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline">
            <Ban className="h-3 w-3 mr-1" />
            已取消
          </Badge>
        );
      case "pending":
        return <Badge variant="outline">待处理</Badge>;
      case "paused":
        return <Badge variant="outline">已暂停</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="数据迁移向导" description="在不同云存储桶之间迁移数据" showBack />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>数据迁移向导 - 步骤 {step}</span>
            {step === 3 && getStatusBadge()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {globalError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-medium border-b pb-2">源端</h3>
                <div className="space-y-2">
                  <Label>账户</Label>
                  <Select onValueChange={setSourceId} value={sourceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择账户" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsList.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} ({acc.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bucket 名称</Label>
                  <Input
                    value={sourceBucket}
                    onChange={(e) => setSourceBucket(e.target.value)}
                    placeholder="my-source-bucket"
                  />
                </div>
                <div className="space-y-2">
                  <Label>前缀 (可选)</Label>
                  <Input
                    value={sourcePrefix}
                    onChange={(e) => setSourcePrefix(e.target.value)}
                    placeholder="folders/to/move/"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium border-b pb-2">目标端</h3>
                <div className="space-y-2">
                  <Label>账户</Label>
                  <Select onValueChange={setDestId} value={destId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择账户" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountsList.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} ({acc.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bucket 名称</Label>
                  <Input
                    value={destBucket}
                    onChange={(e) => setDestBucket(e.target.value)}
                    placeholder="my-dest-bucket"
                  />
                </div>
                <div className="space-y-2">
                  <Label>前缀 (可选)</Label>
                  <Input
                    value={destPrefix}
                    onChange={(e) => setDestPrefix(e.target.value)}
                    placeholder="destination/folder/"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 max-w-md mx-auto">
              <h3 className="font-medium">配置选项</h3>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="delSrc"
                  checked={deleteSource}
                  onCheckedChange={(c) => setDeleteSource(!!c)}
                />
                <Label htmlFor="delSrc">删除源文件（移动模式）</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="overwrite"
                  checked={overwrite}
                  onCheckedChange={(c) => setOverwrite(!!c)}
                />
                <Label htmlFor="overwrite">覆盖目标端已有文件</Label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>进度</span>
                  <span>{getProgressPercent()}%</span>
                </div>
                <Progress value={getProgressPercent()} className="w-full h-3" />
              </div>

              <p className="text-sm text-muted-foreground text-center">任务 ID: {jobId}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-md">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats?.processed_objects || 0}</div>
                  <div className="text-xs text-muted-foreground">已处理</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats?.total_objects || 0}</div>
                  <div className="text-xs text-muted-foreground">总对象数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {stats?.copied_objects || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">已复制</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {stats?.failed_objects || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">失败</div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {step > 1 && step < 3 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              上一步
            </Button>
          )}
          {step === 1 && <Button onClick={() => setStep(2)}>下一步：配置选项</Button>}
          {step === 2 && <Button onClick={handleCreateJob}>开始迁移</Button>}
          {step === 3 && (
            <div className="flex gap-2 w-full justify-between">
              {status === "running" && (
                <Button variant="outline" onClick={() => setCancelConfirmOpen(true)}>
                  取消任务
                </Button>
              )}
              <Button variant="outline" onClick={handleReset} className="ml-auto">
                开始新迁移
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>

      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消</AlertDialogTitle>
            <AlertDialogDescription>确认要取消当前迁移任务吗？</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>暂不取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive hover:bg-destructive/90"
            >
              确认取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
