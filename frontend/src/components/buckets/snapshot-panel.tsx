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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useParams } from "@tanstack/react-router";
import {
  CreateBucketSnapshot,
  DeleteBucketSnapshot,
  ListBucketSnapshots,
} from "@wailsjs/go/app/App";
import { backup } from "@wailsjs/go/models";
import { AlertCircle, Camera, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export function SnapshotPanel() {
  const { accountId, bucketId } = useParams({
    from: "/accounts/$accountId/buckets/$bucketId/settings",
  });
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<backup.BackupHeader[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSnapshots();
  }, [accountId, bucketId]);

  const loadSnapshots = async () => {
    if (!accountId || !bucketId) return;
    setListLoading(true);
    try {
      const list = await ListBucketSnapshots(accountId, bucketId);
      setSnapshots(list || []);
    } catch (err) {
      console.error("Failed to load snapshots:", err);
    } finally {
      setListLoading(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!accountId || !bucketId) return;
    setLoading(true);
    setError(null);
    try {
      await CreateBucketSnapshot(accountId, bucketId);
      await loadSnapshots();
    } catch (err) {
      setError("创建快照失败: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await DeleteBucketSnapshot(deleteId);
      await loadSnapshots();
    } catch (err) {
      setError("删除失败: " + String(err));
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleString("zh-CN");
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Bucket 快照
          </CardTitle>
          <CardDescription>
            创建 Bucket 的元数据快照，用于追踪变更或恢复已删除的文件引用。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="bg-muted/50 p-4 rounded-md text-sm text-neutral-600 dark:text-neutral-400">
              快照记录 Bucket
              在特定时间点的状态（对象键、大小、哈希值），不复制实际数据，因此轻量快速。
            </div>
            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={loadSnapshots} disabled={listLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${listLoading ? "animate-spin" : ""}`} />
                刷新列表
              </Button>
              <Button onClick={handleCreateSnapshot} disabled={loading}>
                {loading ? "创建中..." : "创建新快照"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快照列表</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>对象数量</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snap) => (
                  <TableRow key={snap.id}>
                    <TableCell className="font-mono text-xs">{snap.id.slice(0, 8)}...</TableCell>
                    <TableCell>{formatDate(snap.created_at)}</TableCell>
                    <TableCell>{snap.object_count}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(snap.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {snapshots.length === 0 && !listLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <Camera className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>暂无快照记录</p>
          <p className="text-sm">点击「创建新快照」保存当前 Bucket 状态</p>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>确认要删除该快照吗？</AlertDialogDescription>
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
