import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ObjectModel } from "@/state/objects";
import { objectsStore, useObjectsStore } from "@/state/objects";
import type { objects as ObjectModels } from "@wailsjs/go/models";
import { Loader2, ShieldCheck, Tags, Warehouse } from "lucide-react";

type KeyValue = { key: string; value: string; id: string };

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

type BatchAttributesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objects: ObjectModel[];
};

const buildRecord = (entries: KeyValue[]) => {
  const result: Record<string, string> = {};
  entries.forEach(({ key, value }) => {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey || !trimmedValue) return;
    result[trimmedKey] = trimmedValue;
  });
  return result;
};

export function BatchAttributesDialog({ open, onOpenChange, objects }: BatchAttributesDialogProps) {
  const bucket = useObjectsStore((s) => s.bucket);
  const [activeTab, setActiveTab] = useState<"tags" | "storage" | "acl">("tags");
  const [tagEntries, setTagEntries] = useState<KeyValue[]>([
    { key: "", value: "", id: createId() },
  ]);
  const [storageClass, setStorageClass] = useState("STANDARD");
  const [acl, setAcl] = useState("private");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ObjectModels.BatchAttributesResult>();
  const [error, setError] = useState<string>();

  const selectedCount = objects.length;

  const validTagEntries = useMemo(() => buildRecord(tagEntries), [tagEntries]);

  const resetState = () => {
    setActiveTab("tags");
    setTagEntries([{ key: "", value: "", id: createId() }]);
    setStorageClass("STANDARD");
    setAcl("private");
    setSubmitting(false);
    setResult(undefined);
    setError(undefined);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const canSubmit = useMemo(() => {
    if (selectedCount === 0) return false;
    if (activeTab === "tags") {
      return Object.keys(validTagEntries).length > 0;
    }
    return true;
  }, [activeTab, selectedCount, validTagEntries]);

  const handleApply = async () => {
    if (!bucket || selectedCount === 0 || !canSubmit) return;
    setSubmitting(true);
    setError(undefined);
    setResult(undefined);
    try {
      const patches = objects.map((object) => {
        const base: Partial<ObjectModels.ObjectAttributesPatch> = {
          bucket,
          key: object.key,
        };
        if (activeTab === "tags") {
          base.tags = validTagEntries;
        } else if (activeTab === "storage") {
          base.storageClass = storageClass;
        } else if (activeTab === "acl") {
          base.acl = acl;
        }
        return base as ObjectModels.ObjectAttributesPatch;
      });
      const outcome = await objectsStore.batchUpdateAttributes(patches);
      setResult(outcome);
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量更新失败");
    } finally {
      setSubmitting(false);
    }
  };

  const addTagRow = () => {
    setTagEntries((entries) => [...entries, { key: "", value: "", id: createId() }]);
  };

  const updateTagRow = (id: string, payload: Partial<KeyValue>) => {
    setTagEntries((entries) =>
      entries.map((entry) => (entry.id === id ? { ...entry, ...payload } : entry)),
    );
  };

  const removeTagRow = (id: string) => {
    setTagEntries((entries) =>
      entries.length === 1 ? entries : entries.filter((entry) => entry.id !== id),
    );
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? handleClose() : onOpenChange(value))}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>批量编辑属性</DialogTitle>
          <DialogDescription>
            一次性更新 {selectedCount} 个对象的标签、存储类型或 ACL。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tags" className="gap-2">
              <Tags className="h-4 w-4" /> 标签
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2">
              <Warehouse className="h-4 w-4" /> 存储类型
            </TabsTrigger>
            <TabsTrigger value="acl" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> ACL
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <TabsContent value="tags" className="space-y-4">
              <p className="text-sm text-muted-foreground">为所有选中对象设置统一的标签键值对。</p>
              <div className="space-y-2">
                {tagEntries.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-10 gap-2">
                    <Input
                      className="col-span-4"
                      placeholder="Key"
                      value={entry.key}
                      onChange={(e) => updateTagRow(entry.id, { key: e.target.value })}
                    />
                    <Input
                      className="col-span-5"
                      placeholder="Value"
                      value={entry.value}
                      onChange={(e) => updateTagRow(entry.id, { value: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="col-span-1 text-destructive"
                      onClick={() => removeTagRow(entry.id)}
                      disabled={tagEntries.length === 1}
                    >
                      删除
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addTagRow}>
                添加标签
              </Button>
            </TabsContent>

            <TabsContent value="storage" className="space-y-4">
              <div className="space-y-2">
                <Label>存储类型</Label>
                <Select value={storageClass} onValueChange={setStorageClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择存储类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">STANDARD</SelectItem>
                    <SelectItem value="STANDARD_IA">STANDARD_IA</SelectItem>
                    <SelectItem value="GLACIER">GLACIER</SelectItem>
                    <SelectItem value="DEEP_ARCHIVE">DEEP_ARCHIVE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                注意：部分供应商可能不支持所有存储类型，失败项会在结果中列出。
              </p>
            </TabsContent>

            <TabsContent value="acl" className="space-y-4">
              <div className="space-y-2">
                <Label>ACL 权限</Label>
                <Select value={acl} onValueChange={setAcl}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择 ACL" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">private</SelectItem>
                    <SelectItem value="public-read">public-read</SelectItem>
                    <SelectItem value="public-read-write">public-read-write</SelectItem>
                    <SelectItem value="authenticated-read">authenticated-read</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                对公共读/写务必谨慎，可能导致数据暴露。
              </p>
            </TabsContent>
          </div>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-sm">
            <p>
              已应用：{result.succeeded}/{result.total} 项
            </p>
            {result.failed?.length ? (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {result.failed.map((failure) => (
                  <div key={`${failure.bucket}/${failure.key}`}>
                    {failure.key}: {failure.error}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleApply} disabled={!canSubmit || submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            应用到 {selectedCount} 项
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
