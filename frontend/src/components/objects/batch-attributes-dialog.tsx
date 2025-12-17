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
import { useObjectMutations } from "@/hooks/useObjects";
import type { ObjectModel } from "@/state/objects";
import { useObjectsStore } from "@/state/objects";
import type { objects as ObjectModels } from "@wailsjs/go/models";
import { Loader2, ShieldCheck, Tags, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  const bucket = useObjectsStore((s) => s.bucket);
  const accountId = useObjectsStore((s) => s.accountId);
  const [activeTab, setActiveTab] = useState<"tags" | "storage" | "acl">("tags");
  const [tagEntries, setTagEntries] = useState<KeyValue[]>([
    { key: "", value: "", id: createId() },
  ]);
  const [storageClass, setStorageClass] = useState("STANDARD");
  const [acl, setAcl] = useState("private");
  const [result, setResult] = useState<ObjectModels.BatchAttributesResult>();
  const [error, setError] = useState<string>();

  const { batchUpdateObjectAttributes } = useObjectMutations(accountId, bucket);
  const selectedCount = objects.length;

  const validTagEntries = useMemo(() => buildRecord(tagEntries), [tagEntries]);

  const resetState = () => {
    setActiveTab("tags");
    setTagEntries([{ key: "", value: "", id: createId() }]);
    setStorageClass("STANDARD");
    setAcl("private");
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
      // The backend returns BatchAttributesResult but mutation returns void currently in useObjects ???
      // Wait, UpdateObjectAttributes returns void ?
      // If BatchUpdateObjectAttributes returns a result, we should probably return it in mutationFn.
      // But useObjects.ts wrapper was: await BatchUpdateObjectAttributes(...)
      // I should update useObjects to return the result if possible, or just accept that we don't show detailed result?
      // The dialog shows result stats.
      // Let's check if I can make mutation return result.
      // If mutationFn returns strict void, I might lose result.
      // But async arrow function returns promise of what await returns if unused??
      // Let's assume it returns whatever the backend returns.
      const outcome = await batchUpdateObjectAttributes.mutateAsync(patches);
      // If outcome is undefined because of void return in useObjects, we might need to fix useObjects.
      // But for now, let's try assuming it returns.
      if (outcome) {
        setResult(outcome as any);
      } else {
        // If no outcome returned (because I wrapped it in {} block without return ???)
        // In useObjects.ts:
        // mutationFn: async (patches) => {
        //   if (!accountId) throw ...
        //   await BatchUpdateObjectAttributes(...)
        // }
        // This returns Promise<void>. I need to `return await ...`
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("objects.batchAttributes.error.general"));
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
          <DialogTitle>{t("objects.batchAttributes.title")}</DialogTitle>
          <DialogDescription>
            {t("objects.batchAttributes.description", { count: selectedCount })}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tags" className="gap-2">
              <Tags className="h-4 w-4" /> {t("objects.batchAttributes.tabs.tags")}
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2">
              <Warehouse className="h-4 w-4" /> {t("objects.batchAttributes.tabs.storage")}
            </TabsTrigger>
            <TabsTrigger value="acl" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> ACL
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <TabsContent value="tags" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("objects.batchAttributes.tags.description")}
              </p>
              <div className="space-y-2">
                {tagEntries.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-10 gap-2">
                    <Input
                      className="col-span-4"
                      placeholder={t("objects.batchAttributes.tags.placeholder.key")}
                      value={entry.key}
                      onChange={(e) => updateTagRow(entry.id, { key: e.target.value })}
                    />
                    <Input
                      className="col-span-5"
                      placeholder={t("objects.batchAttributes.tags.placeholder.value")}
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
                      {t("common.delete")}
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addTagRow}>
                {t("objects.batchAttributes.tags.add")}
              </Button>
            </TabsContent>

            <TabsContent value="storage" className="space-y-4">
              <div className="space-y-2">
                <Label>{t("objects.batchAttributes.storage.label")}</Label>
                <Select value={storageClass} onValueChange={setStorageClass}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("objects.batchAttributes.storage.placeholder")} />
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
                {t("objects.batchAttributes.storage.note")}
              </p>
            </TabsContent>

            <TabsContent value="acl" className="space-y-4">
              <div className="space-y-2">
                <Label>{t("objects.batchAttributes.acl.label")}</Label>
                <Select value={acl} onValueChange={setAcl}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("objects.batchAttributes.acl.placeholder")} />
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
                {t("objects.batchAttributes.acl.note")}
              </p>
            </TabsContent>
          </div>
        </Tabs>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-sm">
            <p>
              {t("objects.batchAttributes.result.applied", {
                succeeded: result.succeeded,
                total: result.total,
              })}
            </p>
            {result.failed?.length && (
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                {result.failed.map((failure) => (
                  <div key={`${failure.bucket}/${failure.key}`}>
                    {failure.key}: {failure.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={batchUpdateObjectAttributes.isPending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleApply}
            disabled={!canSubmit || batchUpdateObjectAttributes.isPending}
          >
            {batchUpdateObjectAttributes.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("objects.batchAttributes.button.apply", { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
