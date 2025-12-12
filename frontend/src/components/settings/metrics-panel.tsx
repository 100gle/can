import { formatBytes } from "@/lib/utils";
import { GetSystemMetrics } from "@wailsjs/go/app/App";
import { system } from "@wailsjs/go/models";
import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type MetricsPanelProps = {
  pollInterval?: number;
};

export const MetricsPanel = memo(function MetricsPanel({
  pollInterval = 2000,
}: MetricsPanelProps) {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<system.SystemMetrics | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMetrics = async () => {
      try {
        const data = await GetSystemMetrics();
        if (!cancelled) {
          setMetrics(data);
        }
      } catch (e) {
        console.error("Failed to fetch system metrics", e);
      }
    };

    void fetchMetrics();
    const interval = window.setInterval(fetchMetrics, pollInterval);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollInterval]);

  if (!metrics) {
    return <p className="text-sm text-muted-foreground">{t("system.metrics.loading")}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t("system.metrics.memoryAlloc")}</p>
        <p className="text-lg font-bold">{formatBytes(metrics.memoryAlloc)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t("system.metrics.memorySys")}</p>
        <p className="text-lg font-bold">{formatBytes(metrics.memorySys)}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Goroutines</p>
        <p className="text-lg font-bold">{metrics.numGoroutines}</p>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">{t("system.metrics.activeTransfers")}</p>
        <p className="text-lg font-bold">{metrics.activeTransfers}</p>
      </div>
    </div>
  );
});
