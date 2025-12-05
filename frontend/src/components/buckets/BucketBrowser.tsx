import { useEffect, useMemo, useState } from "react";
import { Folder, FolderPlus, Loader2, RefreshCcw, Settings2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { bucketsStore, useBucketsStore } from "@/state/buckets";
import type { ProviderCapability } from "@/state/accounts";

export type BucketBrowserProps = {
  accountId?: string;
  providerId?: string;
  capabilities?: ProviderCapability[];
  onSelectBucket?: (bucket: string | undefined) => void;
  onOpenSettings?: (bucket: string) => void;
  className?: string;
};

const bucketFeatureIds = new Set(["bucket.storage_class", "bucket.multi_az", "bucket.custom_domain"]);

export function BucketBrowser({
  accountId,
  providerId,
  capabilities,
  onSelectBucket,
  onOpenSettings,
  className,
}: BucketBrowserProps) {
  const { buckets, loading, creating, deleting, error, selectedBucket } = useBucketsStore(
    (state) => state,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("us-east-1");

  useEffect(() => {
    if (accountId) {
      void bucketsStore.loadBuckets(accountId);
    } else {
      bucketsStore.reset();
    }
  }, [accountId]);

  useEffect(() => {
    if (onSelectBucket) {
      onSelectBucket(selectedBucket);
    }
  }, [selectedBucket, onSelectBucket]);

  const isReady = Boolean(accountId);
  const bucketList = useMemo(() => buckets ?? [], [buckets]);
  const capabilityHints = useMemo(() => {
    if (!capabilities?.length) return [];
    return capabilities.filter((cap) => {
      if (!bucketFeatureIds.has(cap.featureId)) return false;
      if (providerId && cap.provider !== providerId) return false;
      return true;
    });
  }, [capabilities, providerId]);

  const handleCreate = async () => {
    if (!accountId) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      window.alert?.("请输入 Bucket 名称");
      return;
    }
    try {
      await bucketsStore.createBucket(accountId, trimmedName, region.trim());
      setFormOpen(false);
      setName("");
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (bucketName: string) => {
    if (!accountId) return;
    const confirmed = window.confirm?.(`确定删除存储桶 ${bucketName} 吗？该操作不可恢复`);
    if (!confirmed) return;
    try {
      await bucketsStore.deleteBucket(accountId, bucketName);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Card className={cn("flex h-full flex-col", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border/40 p-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">存储桶</p>
          <h3 className="text-lg font-semibold">Bucket Browser</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => accountId && bucketsStore.refresh()}
            disabled={!accountId || loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            刷新
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1"
            onClick={() => setFormOpen((prev) => !prev)}
            disabled={!isReady}
          >
            <FolderPlus className="h-4 w-4" />
            新建
          </Button>
        </div>
      </div>
      {error ? <p className="px-4 pt-3 text-sm text-destructive">{error}</p> : null}
      {formOpen ? (
        <div className="space-y-2 border-b border-border/40 px-4 py-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">名称</label>
            <input
              className="rounded-md border border-border/60 bg-transparent px-3 py-1 text-sm"
              placeholder="例如: media-assets"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">区域</label>
            <input
              className="rounded-md border border-border/60 bg-transparent px-3 py-1 text-sm"
              placeholder="us-east-1 / auto"
              value={region}
              onChange={(event) => setRegion(event.target.value)}
            />
          </div>
          {capabilityHints.length ? (
            <div className="rounded-md border border-border/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                供应商特性
              </p>
              <ul className="mt-2 space-y-2">
                {capabilityHints.map((capability) => (
                  <li key={capability.featureId} className="text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "mr-2 inline-flex items-center font-medium",
                        capability.supported ? "text-emerald-600" : "text-destructive",
                      )}
                    >
                      {capability.supported ? "支持" : "不支持"}
                    </span>
                    <span className="font-medium text-foreground">{capability.name}</span>
                    <p>
                      {capability.supported
                        ? capability.description
                        : capability.message || capability.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={creating || !isReady}
              className="gap-1"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              创建
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto p-4">
        {!isReady ? (
          <p className="text-sm text-muted-foreground">请选择账户以加载存储桶。</p>
        ) : bucketList.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">尚未发现 Bucket，可以新建一个。</p>
        ) : (
          <ul className="space-y-2">
            {bucketList.map((bucket) => (
              <li
                key={bucket.name}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border border-border/40 px-3 py-2",
                  bucket.name === selectedBucket ? "bg-primary/10" : "bg-background",
                )}
                onClick={() => bucketsStore.selectBucket(bucket.name)}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-primary" />
                    <span className="font-medium">{bucket.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{bucket.region || "未设置区域"}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatDate(bucket.createdAt)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenSettings?.(bucket.name);
                    }}
                    aria-label={`打开 ${bucket.name} 设置`}
                  >
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(bucket.name);
                    }}
                    disabled={Boolean(deleting[bucket.name])}
                  >
                    {deleting[bucket.name] ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

const formatDate = (value: any) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value);
  }
};
