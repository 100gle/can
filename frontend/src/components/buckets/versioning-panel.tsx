import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { bucketConfigStore, useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const VersioningPanel = () => {
  const { t } = useTranslation();
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
        <h3 className="text-xl font-semibold">{t("bucket.versioning.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bucket.versioning.description")}</p>
      </header>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <RadioGroup
        value={status}
        onValueChange={(value: "Enabled" | "Suspended") => setStatus(value)}
        className="space-y-3"
      >
        {(["Enabled", "Suspended"] as const).map((option) => {
          const optionId = `versioning-${option}`;
          return (
            <div
              key={option}
              className="flex items-start gap-3 rounded-lg border border-border/50 p-3"
            >
              <RadioGroupItem value={option} id={optionId} disabled={loading} />
              <div>
                <Label htmlFor={optionId} className="font-medium">
                  {option === "Enabled"
                    ? t("bucket.versioning.enabled")
                    : t("bucket.versioning.suspended")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {option === "Enabled"
                    ? t("bucket.versioning.enabledDesc")
                    : t("bucket.versioning.suspendedDesc")}
                </p>
              </div>
            </div>
          );
        })}
      </RadioGroup>
      <Button onClick={handleSave} disabled={Boolean(saving)} className="gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bucket.versioning.save")}
      </Button>
    </div>
  );
};
