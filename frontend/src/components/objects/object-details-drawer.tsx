import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { isBridgeAvailable } from "@/lib/bridge";
import { objectsStore, useObjectsStore } from "@/state/objects";
import {
  GetBucketVersioning,
  GetObjectLegalHold,
  GetObjectLockConfiguration,
  GetObjectRetention,
  UpdateObjectLegalHold,
  UpdateObjectRetention,
} from "@wailsjs/go/app/App";
import { config, objects } from "@wailsjs/go/models";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type KeyValueEditorProps = {
  data: Record<string, string>;
  onChange: (data: Record<string, string>) => void;
};

function KeyValueEditor({ data, onChange }: KeyValueEditorProps) {
  const entries = Object.entries(data);

  const handleChange = (index: number, key: string, value: string) => {
    const newEntries = [...entries];
    newEntries[index] = [key, value];
    onChange(Object.fromEntries(newEntries));
  };

  const handleDelete = (index: number) => {
    const newEntries = [...entries];
    newEntries.splice(index, 1);
    onChange(Object.fromEntries(newEntries));
  };

  const handleAdd = () => {
    onChange({ ...data, "": "" });
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-10 gap-2 text-xs font-medium text-muted-foreground">
        <div className="col-span-4">Key</div>
        <div className="col-span-5">Value</div>
        <div className="col-span-1"></div>
      </div>
      {entries.map(([k, v], i) => (
        <div key={i} className="grid grid-cols-10 gap-2">
          <Input
            className="col-span-4 h-8"
            placeholder="Key"
            value={k}
            onChange={(e) => handleChange(i, e.target.value, v)}
          />
          <Input
            className="col-span-5 h-8"
            placeholder="Value"
            value={v}
            onChange={(e) => handleChange(i, k, e.target.value)}
          />
          <Button
            variant="ghost"
            size="icon"
            className="col-span-1 h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => handleDelete(i)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
        <Plus className="mr-2 h-4 w-4" /> 添加条目
      </Button>
    </div>
  );
}

type ObjectDetailsDrawerProps = {
  open: boolean;
  objectKey?: string;
  onClose: () => void;
};

export function ObjectDetailsDrawer({ open, objectKey, onClose }: ObjectDetailsDrawerProps) {
  const { accountId, bucket } = useObjectsStore((s) => s);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attributes, setAttributes] = useState<objects.ObjectAttributes | null>(null);

  // Edit states
  const [metadata, setMetadata] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Record<string, string>>({});
  const [contentType, setContentType] = useState("");
  const [storageClass, setStorageClass] = useState("");
  const [acl, setAcl] = useState("private");
  const [versioning, setVersioning] = useState<config.BucketVersioning | null>(null);
  const [lockConfig, setLockConfig] = useState<objects.ObjectLockConfiguration | null>(null);
  const [retentionState, setRetentionState] = useState<objects.ObjectRetentionState | null>(null);
  const [legalHoldState, setLegalHoldState] = useState<objects.ObjectLegalHoldState | null>(null);
  const [retentionMode, setRetentionMode] = useState("GOVERNANCE");
  const [retainUntil, setRetainUntil] = useState("");
  const [bypassGovernance, setBypassGovernance] = useState(false);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState<string | null>(null);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [legalHoldSaving, setLegalHoldSaving] = useState(false);
  const info = attributes?.object;

  useEffect(() => {
    if (open && objectKey) {
      loadAttributes(objectKey);
    } else {
      setAttributes(null);
    }
  }, [open, objectKey]);

  useEffect(() => {
    if (!open || !accountId || !bucket) {
      setVersioning(null);
      return;
    }
    const loadVersioning = async () => {
      try {
        const status = await GetBucketVersioning(accountId, bucket);
        setVersioning(status);
      } catch (error) {
        console.warn("获取版本控制状态失败", error);
        setVersioning(null);
      }
    };
    void loadVersioning();
  }, [open, accountId, bucket]);

  useEffect(() => {
    if (!open || !objectKey || !accountId || !bucket || !isBridgeAvailable()) {
      setLockConfig(null);
      setRetentionState(null);
      setLegalHoldState(null);
      setComplianceError(null);
      return;
    }
    const loadCompliance = async () => {
      setComplianceLoading(true);
      try {
        const versionId = info?.versionId || "";
        const [lockCfg, retention, legal] = await Promise.all([
          GetObjectLockConfiguration(accountId, bucket),
          GetObjectRetention(accountId, bucket, objectKey, versionId),
          GetObjectLegalHold(accountId, bucket, objectKey, versionId),
        ]);
        setLockConfig(lockCfg);
        setRetentionState(retention);
        setLegalHoldState(legal);
        if (retention?.mode) {
          setRetentionMode(retention.mode);
        } else if (lockCfg?.mode) {
          setRetentionMode(lockCfg.mode);
        }
        setRetainUntil(retention?.retainUntil ? formatLocalInput(retention.retainUntil) : "");
        setComplianceError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : "加载合规信息失败";
        setComplianceError(message);
      } finally {
        setComplianceLoading(false);
      }
    };
    void loadCompliance();
  }, [open, objectKey, accountId, bucket, info?.versionId]);

  const loadAttributes = async (key: string) => {
    setLoading(true);
    try {
      const attrs = await objectsStore.getObjectAttributes(key);
      setAttributes(attrs);
      // Initialize edit states
      setMetadata(attrs.metadata || {});
      setTags(attrs.tags || {});
      setContentType(attrs.object.contentType || "");
      setStorageClass(attrs.object.storageClass || "STANDARD");
      setAcl(attrs.acl || "private");
    } catch (error) {
      console.error("Failed to load attributes", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accountId || !bucket || !objectKey) return;
    setSaving(true);
    try {
      await objectsStore.updateObjectAttributes({
        bucket,
        key: objectKey,
        metadata,
        tags,
        contentType,
        storageClass,
        acl,
      });
      // objectsStore.refresh(); // Usually handled by wrapper but good to be sure
      onClose();
    } catch (error) {
      console.error("Failed to save attributes", error);
    } finally {
      setSaving(false);
    }
  };

  const handleRetentionUpdate = async () => {
    if (!accountId || !bucket || !objectKey || !retainUntil) {
      toast.error("请填写保留到期时间");
      return;
    }
    setRetentionSaving(true);
    try {
      const payload = {
        bucket,
        key: objectKey,
        versionId: info?.versionId ?? "",
        mode: retentionMode,
        retainUntil: new Date(retainUntil).toISOString(),
        bypassGovernance,
      } as objects.UpdateObjectRetentionInput;
      const updated = await UpdateObjectRetention(accountId, payload);
      setRetentionState(updated);
      toast.success("对象保留策略已更新");
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新保留策略失败";
      toast.error(message);
    } finally {
      setRetentionSaving(false);
    }
  };

  const handleLegalHoldToggle = async (next: boolean) => {
    if (!accountId || !bucket || !objectKey) return;
    setLegalHoldSaving(true);
    try {
      const payload = {
        bucket,
        key: objectKey,
        versionId: info?.versionId ?? "",
        status: next ? "ON" : "OFF",
      } as objects.UpdateObjectLegalHoldInput;
      const updated = await UpdateObjectLegalHold(accountId, payload);
      setLegalHoldState(updated);
      toast.success(next ? "已启用法律保留" : "已关闭法律保留");
    } catch (error) {
      const message = error instanceof Error ? error.message : "更新法律保留失败";
      toast.error(message);
    } finally {
      setLegalHoldSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>对象详情</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !attributes ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            无法加载对象详情
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-6">
            <div className="space-y-4 rounded-lg border p-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-muted-foreground">Key</span>
                <span className="col-span-2 truncate font-mono select-all">{info?.key}</span>

                <span className="text-muted-foreground">Size</span>
                <span className="col-span-2">{info?.size} bytes</span>

                <span className="text-muted-foreground">Last Modified</span>
                <span className="col-span-2">{info?.lastModified}</span>

                <span className="text-muted-foreground">ETag</span>
                <span className="col-span-2 font-mono text-xs">{info?.etag}</span>
                {info?.isSymlink && (
                  <>
                    <span className="text-muted-foreground">Symlink</span>
                    <span className="col-span-2 text-sm text-muted-foreground">
                      → {info.symlinkTarget || "未指定目标"}
                    </span>
                  </>
                )}
              </div>
            </div>

            <Tabs defaultValue="general">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">常规</TabsTrigger>
                <TabsTrigger value="metadata">元数据</TabsTrigger>
                <TabsTrigger value="tags">标签</TabsTrigger>
                <TabsTrigger value="compliance">合规</TabsTrigger>
              </TabsList>

              <div className="my-4 h-[calc(100vh-400px)] overflow-y-auto pr-2">
                <TabsContent value="general" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Content-Type</Label>
                    <Input value={contentType} onChange={(e) => setContentType(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Storage Class</Label>
                    <Input value={storageClass} onChange={(e) => setStorageClass(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>ACL</Label>
                    <Select value={acl} onValueChange={setAcl}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="public-read">Public Read</SelectItem>
                        <SelectItem value="public-read-write">Public Read Write</SelectItem>
                        <SelectItem value="authenticated-read">Authenticated Read</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 rounded-md border border-border/60 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>版本控制</Label>
                        <p className="text-xs text-muted-foreground">
                          {versioning?.status === "Enabled"
                            ? "Bucket 已启用版本控制"
                            : "尚未启用版本控制，仅保留最新版本"}
                        </p>
                      </div>
                      <span className="rounded-full border px-2 py-1 text-xs">
                        {versioning?.status ?? "Unknown"}
                      </span>
                    </div>
                    {info?.versionId ? (
                      <div className="space-y-1">
                        <Label className="text-xs">当前版本 ID</Label>
                        <div className="flex items-center gap-2">
                          <Input value={info.versionId} readOnly className="font-mono text-xs" />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(info.versionId || "")}
                          >
                            复制
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">当前对象没有版本信息。</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      历史版本展示与恢复将在后续版本开放，可在 Bucket 设置中启用版本控制以开始记录。
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="metadata">
                  <KeyValueEditor data={metadata} onChange={setMetadata} />
                </TabsContent>

                <TabsContent value="tags">
                  <KeyValueEditor data={tags} onChange={setTags} />
                </TabsContent>

                <TabsContent value="compliance" className="space-y-4">
                  {!isBridgeAvailable() ? (
                    <p className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                      Bridge 未就绪，无法获取对象锁信息。
                    </p>
                  ) : complianceLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      加载合规信息...
                    </div>
                  ) : complianceError ? (
                    <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                      {complianceError}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-1 rounded-md border border-border/60 p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">对象锁配置</p>
                            <p className="text-xs text-muted-foreground">
                              {lockConfig?.enabled ? "Bucket 已启用默认保留" : "尚未启用默认对象锁"}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {lockConfig?.mode || "未设置"}
                          </span>
                        </div>
                        {lockConfig?.retentionDays ? (
                          <p className="text-xs text-muted-foreground">
                            默认保留 {lockConfig.retentionDays} 天
                          </p>
                        ) : lockConfig?.retentionYears ? (
                          <p className="text-xs text-muted-foreground">
                            默认保留 {lockConfig.retentionYears} 年
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-3 rounded-md border border-border/60 p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">对象保留</p>
                          {retentionState?.retainUntil && (
                            <span className="text-xs text-muted-foreground">
                              当前：{new Date(retentionState.retainUntil).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">模式</Label>
                            <Select value={retentionMode} onValueChange={setRetentionMode}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="GOVERNANCE">Governance</SelectItem>
                                <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">保留到期</Label>
                            <Input
                              type="datetime-local"
                              value={retainUntil}
                              onChange={(e) => setRetainUntil(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="bypass-governance"
                            checked={bypassGovernance}
                            onCheckedChange={setBypassGovernance}
                          />
                          <Label
                            htmlFor="bypass-governance"
                            className="text-xs text-muted-foreground"
                          >
                            Bypass Governance
                          </Label>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleRetentionUpdate}
                          disabled={retentionSaving || !retainUntil}
                          className="w-fit"
                        >
                          {retentionSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          保存保留策略
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                        <div>
                          <p className="font-medium text-sm">法律保留</p>
                          <p className="text-xs text-muted-foreground">
                            防止对象被删除或覆盖，适用于审计场景。
                          </p>
                        </div>
                        <Switch
                          checked={legalHoldState?.status === "ON"}
                          disabled={legalHoldSaving}
                          onCheckedChange={handleLegalHoldToggle}
                        />
                      </div>
                    </>
                  )}
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        <SheetFooter className="mt-auto">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            保存
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const formatLocalInput = (iso: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
