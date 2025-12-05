import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bucketConfigStore, useBucketConfigStore } from "@/state/bucketConfig";

export const VersioningPanel = () => {
  const versioning = useBucketConfigStore((state) => state.versioning);
  const loading = useBucketConfigStore((state) => state.loading);
  const saving = useBucketConfigStore((state) => state.saving.versioning);
  const error = useBucketConfigStore((state) => state.error);
  const [status, setStatus] = useState<"Enabled" | "Suspended">("Suspended");

  useEffect(() => {
    setStatus((versioning?.status as "Enabled" | "Suspended") || "Suspended");
  }, [versioning?.status]);

  const handleSave = () => {
    void bucketConfigStore.saveVersioning(status);
  };

  return (
    <div className="space-y-4">
      <header>
        <h3 className="text-xl font-semibold">版本控制</h3>
        <p className="text-sm text-muted-foreground">
          启用版本控制后，存储桶会为对象的每一次变更保留历史版本。
        </p>
      </header>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="space-y-3">
        {(["Enabled", "Suspended"] as const).map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border/50 p-3"
          >
            <input
              type="radio"
              name="versioning"
              value={option}
              checked={status === option}
              onChange={() => setStatus(option)}
              disabled={loading}
            />
            <div>
              <p className="font-medium">{option === "Enabled" ? "已启用" : "已暂停"}</p>
              <p className="text-sm text-muted-foreground">
                {option === "Enabled"
                  ? "所有对象的历史版本都会被保留"
                  : "仅保留现有版本，新上传将不追踪版本"}
              </p>
            </div>
          </label>
        ))}
      </div>
      <Button onClick={handleSave} disabled={Boolean(saving)} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        保存
      </Button>
    </div>
  );
};
