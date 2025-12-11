import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { offlineCache } from "@/lib/offline";
import { showSuccess } from "@/lib/toast";
import { formatBytes } from "@/lib/utils";
import { usePreferencesStore, type CacheSize } from "@/state/preferences";
import { useEffect, useState } from "react";

export function OfflineCacheCard() {
  const offlineCacheEnabled = usePreferencesStore((state) => state.offlineCacheEnabled);
  const setOfflineCacheEnabled = usePreferencesStore((state) => state.setOfflineCacheEnabled);
  const offlineCacheSize = usePreferencesStore((state) => state.offlineCacheSize);
  const setOfflineCacheSize = usePreferencesStore((state) => state.setOfflineCacheSize);
  const [cacheUsage, setCacheUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    offlineCache.getUsage().then(setCacheUsage);
  }, []);

  const handleClearOfflineCache = async () => {
    await offlineCache.clear();
    const usage = await offlineCache.getUsage();
    setCacheUsage(usage);
    showSuccess("缓存已清除");
  };

  const handleCacheSizeChange = (value: string) => {
    const numeric = Number(value) as CacheSize;
    setOfflineCacheSize(numeric);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>离线缓存</CardTitle>
          <CardDescription className="text-xs">
            管理离线数据缓存，开启后将缓存最近浏览的列表和文件以便离线访问
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>启用离线缓存</Label>
            <p className="text-xs text-muted-foreground">自动缓存浏览过的存储桶列表和对象列表</p>
          </div>
          <Switch checked={offlineCacheEnabled} onCheckedChange={setOfflineCacheEnabled} />
        </div>
        {offlineCacheEnabled && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>缓存大小</Label>
                <p className="text-xs text-muted-foreground">限制离线缓存的最大占用</p>
              </div>
              <Select value={String(offlineCacheSize)} onValueChange={handleCacheSizeChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 MB</SelectItem>
                  <SelectItem value="50">50 MB</SelectItem>
                  <SelectItem value="100">100 MB</SelectItem>
                  <SelectItem value="500">500 MB</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">当前占用</p>
                  <p className="text-2xl font-bold">
                    {cacheUsage ? formatBytes(cacheUsage.usage) : "Calculating..."}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (Quota: {cacheUsage ? formatBytes(cacheUsage.quota) : "-"})
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearOfflineCache}>
                  清除缓存
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
