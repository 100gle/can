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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isDesktopMode } from "@/lib/bridge";
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
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type KeyValueEditorProps = {
  data: Record<string, string>;
  onChange: (data: Record<string, string>) => void;
};

function KeyValueEditor({ data, onChange }: KeyValueEditorProps) {
  const { t } = useTranslation();
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
        <Plus className="mr-2 h-4 w-4" /> {t("objects.details.kv.add")}
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
  const { t } = useTranslation();
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
    if (!open || !objectKey || !accountId || !bucket || !isDesktopMode()) {
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
        const message =
          error instanceof Error ? error.message : t("objects.details.error.loadCompliance");
        setComplianceError(message);
      } finally {
        setComplianceLoading(false);
      }
    };
    void loadCompliance();
  }, [open, objectKey, accountId, bucket, info?.versionId, t]);

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
      toast.error(t("objects.details.error.retentionTime"));
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
      toast.success(t("objects.details.success.retention"));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("objects.details.error.updateRetention");
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
      toast.success(
        next
          ? t("objects.details.compliance.legalHoldOn")
          : t("objects.details.compliance.legalHoldOff"),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("objects.details.error.updateLegalHold");
      toast.error(message);
    } finally {
      setLegalHoldSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>{t("objects.details.title")}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !attributes ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {t("objects.details.loading")}
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
                <TabsTrigger value="general">{t("objects.details.tabs.general")}</TabsTrigger>
                <TabsTrigger value="metadata">{t("objects.details.tabs.metadata")}</TabsTrigger>
                <TabsTrigger value="tags">{t("objects.details.tabs.tags")}</TabsTrigger>
                <TabsTrigger value="compliance">{t("objects.details.tabs.compliance")}</TabsTrigger>
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
                        <Label>{t("objects.details.general.versioning")}</Label>
                        <p className="text-xs text-muted-foreground">
                          {versioning?.status === "Enabled"
                            ? t("objects.details.general.versioningEnabled")
                            : t("objects.details.general.versioningDisabled")}
                        </p>
                      </div>
                      <span className="rounded-full border px-2 py-1 text-xs">
                        {versioning?.status ?? "Unknown"}
                      </span>
                    </div>
                    {info?.versionId ? (
                      <div className="space-y-1">
                        <Label className="text-xs">
                          {t("objects.details.general.currentVersion")}
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input value={info.versionId} readOnly className="font-mono text-xs" />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(info.versionId || "")}
                          >
                            {t("objects.details.general.copy")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("objects.details.general.noVersion")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {t("objects.details.general.historyHint")}
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
                  {!isDesktopMode() ? (
                    <p className="rounded-md border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
                      {t("objects.details.compliance.bridgeError")}
                    </p>
                  ) : complianceLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("objects.details.compliance.loading")}
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
                            <p className="font-medium">
                              {t("objects.details.compliance.objectLock")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {lockConfig?.enabled
                                ? t("objects.details.compliance.defaultRetentionEnabled")
                                : t("objects.details.compliance.defaultRetentionDisabled")}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {lockConfig?.mode || "未设置"}
                          </span>
                        </div>
                        {lockConfig?.retentionDays && (
                          <p className="text-xs text-muted-foreground">
                            {t("objects.details.compliance.defaultRetentionDays", {
                              days: lockConfig.retentionDays,
                            })}
                          </p>
                        )}
                        {lockConfig?.retentionYears && (
                          <p className="text-xs text-muted-foreground">
                            {t("objects.details.compliance.defaultRetentionYears", {
                              years: lockConfig.retentionYears,
                            })}
                          </p>
                        )}
                      </div>
                      <div className="space-y-3 rounded-md border border-border/60 p-3">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm">
                            {t("objects.details.compliance.objectRetention")}
                          </p>
                          {retentionState?.retainUntil && (
                            <span className="text-xs text-muted-foreground">
                              {t("objects.details.compliance.current", {
                                time: new Date(retentionState.retainUntil).toLocaleString(),
                              })}
                            </span>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">
                              {t("objects.details.compliance.mode")}
                            </Label>
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
                            <Label className="text-xs text-muted-foreground">
                              {t("objects.details.compliance.retainUntil")}
                            </Label>
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
                          {t("objects.details.compliance.save")}
                        </Button>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                        <div>
                          <p className="font-medium text-sm">
                            {t("objects.details.compliance.legalHold")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("objects.details.compliance.legalHoldDesc")}
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
            {t("objects.details.button.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("objects.details.button.save")}
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
