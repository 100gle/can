import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { offlineCache } from "@/lib/offline";
import { showSuccess } from "@/lib/toast";
import { formatBytes } from "@/lib/utils";
import { usePreferencesStore, type CacheSize } from "@/state/preferences";
import { transfersStore, useTransfersStore } from "@/state/transfers";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export function TransferCacheCard() {
  const { t } = useTranslation();
  const workerCount = useTransfersStore((state) => state.workerCount);
  const globalSpeedLimit = useTransfersStore((state) => state.globalSpeedLimit);
  const [speedLimitInput, setSpeedLimitInput] = useState("");
  const offlineCacheEnabled = usePreferencesStore((state) => state.offlineCacheEnabled);
  const setOfflineCacheEnabled = usePreferencesStore((state) => state.setOfflineCacheEnabled);
  const offlineCacheSize = usePreferencesStore((state) => state.offlineCacheSize);
  const setOfflineCacheSize = usePreferencesStore((state) => state.setOfflineCacheSize);
  const [cacheUsage, setCacheUsage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    if (globalSpeedLimit === 0) {
      setSpeedLimitInput("");
    } else {
      setSpeedLimitInput(String(globalSpeedLimit));
    }
  }, [globalSpeedLimit]);

  useEffect(() => {
    offlineCache.getUsage().then(setCacheUsage);
  }, []);

  const handleWorkerCountChange = (val: number[]) => {
    if (val.length > 0) {
      transfersStore.setWorkerCount(val[0]);
    }
  };

  const handleSpeedLimitBlur = () => {
    const val = parseInt(speedLimitInput);
    if (!isNaN(val) && val >= 0) {
      transfersStore.setGlobalSpeedLimit(val);
    } else {
      // reset to current store value
      setSpeedLimitInput(globalSpeedLimit === 0 ? "" : String(globalSpeedLimit));
      if (speedLimitInput === "") {
        transfersStore.setGlobalSpeedLimit(0);
      }
    }
  };

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
      <CardHeader className="pb-4">
        <div className="flex items-baseline gap-2">
          <CardTitle className="text-lg font-semibold">{t("settings.transfer.title")}</CardTitle>
          <CardDescription className="text-sm">{t("settings.transfer.desc")}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Transfer Settings Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">
              {t("settings.transfer.section")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("settings.transfer.sectionDesc")}</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>{t("settings.transfer.workers")}</Label>
                <span className="text-sm font-medium">{workerCount}</span>
              </div>
              <Slider
                min={1}
                max={16}
                step={1}
                value={[workerCount]}
                onValueChange={handleWorkerCountChange}
              />
              <p className="text-xs text-muted-foreground">{t("settings.transfer.workersDesc")}</p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="speed-limit">{t("settings.transfer.speedLimit")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="speed-limit"
                  placeholder={t("settings.transfer.unlimited")}
                  value={speedLimitInput}
                  onChange={(e) => setSpeedLimitInput(e.target.value)}
                  onBlur={handleSpeedLimitBlur}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {globalSpeedLimit > 0
                    ? (globalSpeedLimit / 1024 / 1024).toFixed(2) + " MB/s"
                    : t("settings.transfer.unlimited")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("settings.transfer.speedLimitDesc")}
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Offline Cache Section */}
        <div className="space-y-5">
          <div className="space-y-3">
            <h3 className="text-base font-semibold tracking-tight">
              {t("settings.offline.title")}
            </h3>
            <p className="text-xs text-muted-foreground">{t("settings.offline.desc")}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.offline.enable")}</Label>
              <p className="text-xs text-muted-foreground">{t("settings.offline.enableDesc")}</p>
            </div>
            <Switch checked={offlineCacheEnabled} onCheckedChange={setOfflineCacheEnabled} />
          </div>
          {offlineCacheEnabled && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2">
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
          )}
        </div>
      </CardContent>
    </Card>
  );
}
