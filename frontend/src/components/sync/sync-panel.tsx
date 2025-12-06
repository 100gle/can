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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreateSyncRule,
  DeleteSyncRule,
  ListAccounts,
  ListBuckets,
  ListSyncRules,
  SelectLocalFolder,
  StartSyncRule,
  StopSyncRule,
} from "@wailsjs/go/app/App";
import { accounts, sync } from "@wailsjs/go/models";
import {
  AlertCircle,
  Download,
  FolderOpen,
  FolderSync,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";

type SyncDirection = "upload" | "download" | "bidirectional";

interface FormState {
  id: string;
  name: string;
  accountId: string;
  bucket: string;
  prefix: string;
  localPath: string;
  direction: SyncDirection;
  interval: number;
}

const initialFormState: FormState = {
  id: "",
  name: "",
  accountId: "",
  bucket: "",
  prefix: "",
  localPath: "",
  direction: "upload",
  interval: 0,
};

export function SyncPanel() {
  const [rules, setRules] = useState<sync.SyncRule[]>([]);
  const [accountsList, setAccountsList] = useState<accounts.Account[]>([]);
  const [bucketsList, setBucketsList] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadRules();
    loadAccounts();
  }, []);

  const loadRules = async () => {
    try {
      const list = await ListSyncRules();
      setRules(list || []);
    } catch (err) {
      console.error("Failed to load sync rules:", err);
    }
  };

  const loadAccounts = async () => {
    try {
      const accs = await ListAccounts();
      setAccountsList(accs || []);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  };

  const loadBuckets = async (accountId: string) => {
    if (!accountId) {
      setBucketsList([]);
      return;
    }
    try {
      const buckets = await ListBuckets(accountId);
      setBucketsList(buckets?.map((b) => b.name) || []);
    } catch (err) {
      console.error("Failed to load buckets:", err);
      setBucketsList([]);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setForm((prev) => ({ ...prev, accountId, bucket: "" }));
    loadBuckets(accountId);
  };

  const handleSelectFolder = async () => {
    try {
      const path = await SelectLocalFolder();
      if (path) {
        setForm((prev) => ({ ...prev, localPath: path }));
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  };

  const handleCreateRule = async () => {
    setCreateError(null);
    if (!form.name || !form.accountId || !form.bucket || !form.localPath) {
      setCreateError("请填写所有必填字段");
      return;
    }

    setLoading(true);
    try {
      const ruleId = `rule-${Date.now()}`;
      const newRule: sync.SyncRule = {
        id: ruleId,
        name: form.name,
        accountId: form.accountId,
        bucket: form.bucket,
        prefix: form.prefix,
        localPath: form.localPath,
        direction: form.direction,
        interval: form.interval,
        enabled: true,
        excludeGlob: [],
        lastSync: "",
        nextSync: "",
      };
      await CreateSyncRule(newRule);
      setDialogOpen(false);
      setForm(initialFormState);
      await loadRules();
    } catch (err) {
      setCreateError("创建同步规则失败: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (ruleId: string) => {
    setGlobalError(null);
    try {
      await StartSyncRule(ruleId);
      setRunningJobs((prev) => new Set(prev).add(ruleId));
    } catch (err) {
      setGlobalError("启动同步失败: " + String(err));
    }
  };

  const handleStop = async (ruleId: string) => {
    setGlobalError(null);
    try {
      await StopSyncRule(ruleId);
      setRunningJobs((prev) => {
        const next = new Set(prev);
        next.delete(ruleId);
        return next;
      });
    } catch (err) {
      setGlobalError("停止同步失败: " + String(err));
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setGlobalError(null);
    try {
      await DeleteSyncRule(deleteId);
      await loadRules();
    } catch (err) {
      setGlobalError("删除失败: " + String(err));
    } finally {
      setDeleteId(null);
    }
  };

  const getDirectionIcon = (dir: string) => {
    switch (dir) {
      case "upload":
        return <Upload className="h-4 w-4" />;
      case "download":
        return <Download className="h-4 w-4" />;
      case "bidirectional":
        return <RefreshCw className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getDirectionLabel = (dir: string) => {
    switch (dir) {
      case "upload":
        return "本地 → 远程";
      case "download":
        return "远程 → 本地";
      case "bidirectional":
        return "双向同步";
      default:
        return dir;
    }
  };

  return (
    <div className="container mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FolderSync className="h-6 w-6" />
            同步管理
          </h1>
          <p className="text-muted-foreground mt-1">配置本地文件夹与云端存储桶之间的自动同步规则</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新建规则
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>同步规则</CardTitle>
          <CardDescription>管理您的文件同步任务</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {globalError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>错误</AlertTitle>
              <AlertDescription>{globalError}</AlertDescription>
            </Alert>
          )}
          {rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FolderSync className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>暂无同步规则</p>
              <p className="text-sm">点击「新建规则」创建您的第一个同步任务</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>方向</TableHead>
                  <TableHead>本地路径</TableHead>
                  <TableHead>远程 Bucket</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => {
                  const isRunning = runningJobs.has(rule.id);
                  return (
                    <TableRow key={rule.id}>
                      <TableCell className="font-medium">{rule.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {getDirectionIcon(rule.direction)}
                          <span className="text-sm">{getDirectionLabel(rule.direction)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        {rule.localPath}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {rule.bucket}
                          {rule.prefix ? `/${rule.prefix}` : ""}
                        </code>
                      </TableCell>
                      <TableCell>
                        {isRunning ? (
                          <Badge variant="default" className="bg-green-600">
                            运行中
                          </Badge>
                        ) : (
                          <Badge variant="outline">已停止</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {isRunning ? (
                          <Button variant="outline" size="sm" onClick={() => handleStop(rule.id)}>
                            <Square className="h-3 w-3 mr-1" />
                            停止
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleStart(rule.id)}>
                            <Play className="h-3 w-3 mr-1" />
                            开始
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(rule.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新建同步规则</DialogTitle>
            <DialogDescription>配置本地文件夹与云端存储桶之间的同步任务</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {createError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{createError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">规则名称</Label>
              <Input
                id="name"
                placeholder="例如：文档备份"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>本地文件夹</Label>
              <div className="flex gap-2">
                <Input
                  value={form.localPath}
                  placeholder="选择本地文件夹"
                  readOnly
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleSelectFolder}>
                  <FolderOpen className="h-4 w-4 mr-1" />
                  浏览
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>账户</Label>
                <Select value={form.accountId} onValueChange={handleAccountChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择账户" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountsList.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Bucket</Label>
                <Select
                  value={form.bucket}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, bucket: v }))}
                  disabled={!form.accountId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择 Bucket" />
                  </SelectTrigger>
                  <SelectContent>
                    {bucketsList.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prefix">远程前缀 (可选)</Label>
              <Input
                id="prefix"
                placeholder="例如：backups/docs/"
                value={form.prefix}
                onChange={(e) => setForm((prev) => ({ ...prev, prefix: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>同步方向</Label>
              <Select
                value={form.direction}
                onValueChange={(v) =>
                  setForm((prev) => ({
                    ...prev,
                    direction: v as SyncDirection,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      本地 → 远程（上传）
                    </div>
                  </SelectItem>
                  <SelectItem value="download">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      远程 → 本地（下载）
                    </div>
                  </SelectItem>
                  <SelectItem value="bidirectional">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      双向同步
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="interval">同步间隔 (秒, 0=手动)</Label>
              <Input
                id="interval"
                type="number"
                min={0}
                value={form.interval}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    interval: parseInt(e.target.value) || 0,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateRule} disabled={loading}>
              {loading ? "创建中..." : "创建规则"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确认要删除该同步规则吗？此操作不会删除实际文件。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
