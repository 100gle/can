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
import { bucketService } from "@/lib/services";
import { useParams } from "@tanstack/react-router";
import { backup } from "@wailsjs/go/models";
import { AlertCircle, Camera, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function SnapshotPanel() {
  const { accountId, bucketId } = useParams({
    from: "/accounts/$accountId/buckets/$bucketId/settings",
  });
  const { t } = useTranslation();
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
    const result = await bucketService.listSnapshots(accountId, bucketId);
    setListLoading(false);

    if (result.success) {
      setSnapshots(result.data || []);
    } else {
      setSnapshots([]);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!accountId || !bucketId) return;
    setLoading(true);
    setError(null);

    const result = await bucketService.createSnapshot(accountId, bucketId);
    setLoading(false);

    if (result.success) {
      await loadSnapshots();
    } else {
      setError(result.error);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    const result = await bucketService.deleteSnapshot(deleteId);

    if (result.success) {
      await loadSnapshots();
    } else {
      setError(result.error);
    }

    setDeleteId(null);
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
            {t("bucket.snapshot.title")}
          </CardTitle>
          <CardDescription>{t("bucket.snapshot.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("bucket.snapshot.error")}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="bg-muted/50 p-4 rounded-md text-sm text-neutral-600 dark:text-neutral-400">
              {t("bucket.snapshot.hint")}
            </div>
            <div className="flex justify-between items-center">
              <Button variant="outline" size="sm" onClick={loadSnapshots} disabled={listLoading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${listLoading ? "animate-spin" : ""}`} />
                {t("bucket.snapshot.refresh")}
              </Button>
              <Button onClick={handleCreateSnapshot} disabled={loading}>
                {loading ? t("bucket.snapshot.creating") : t("bucket.snapshot.create")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("bucket.snapshot.listTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("bucket.snapshot.table.id")}</TableHead>
                  <TableHead>{t("bucket.snapshot.table.createdAt")}</TableHead>
                  <TableHead>{t("bucket.snapshot.table.objectCount")}</TableHead>
                  <TableHead className="text-right">{t("bucket.snapshot.table.actions")}</TableHead>
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
          <p>{t("bucket.snapshot.empty")}</p>
          <p className="text-sm">{t("bucket.snapshot.emptyHint")}</p>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("bucket.snapshot.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("bucket.snapshot.deleteConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("actions.cancel", "取消")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("actions.delete", "删除")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
