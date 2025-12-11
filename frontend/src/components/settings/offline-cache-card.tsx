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
import { useTranslation } from "react-i18next";

export function OfflineCacheCard() {
  const { t } = useTranslation();
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
    showSuccess(t("settings.offline.clearSuccess"));
  };

  const handleCacheSizeChange = (value: string) => {
    const numeric = Number(value) as CacheSize;
    setOfflineCacheSize(numeric);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline gap-2">
          <CardTitle>{t("settings.offline.title")}</CardTitle>
          <CardDescription className="text-xs">{t("settings.offline.desc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>{t("settings.offline.enable")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.offline.enableDesc")}</p>
          </div>
          <Switch checked={offlineCacheEnabled} onCheckedChange={setOfflineCacheEnabled} />
        </div>
        {offlineCacheEnabled && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <Label>{t("settings.offline.size")}</Label>
                <p className="text-xs text-muted-foreground">{t("settings.offline.sizeDesc")}</p>
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
                  <p className="text-sm font-medium">{t("settings.offline.currentUsage")}</p>
                  <p className="text-2xl font-bold">
                    {cacheUsage ? formatBytes(cacheUsage.usage) : t("settings.offline.calculating")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    (Quota: {cacheUsage ? formatBytes(cacheUsage.quota) : "-"})
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleClearOfflineCache}>
                  {t("settings.offline.clear")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
