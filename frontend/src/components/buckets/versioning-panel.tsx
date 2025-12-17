import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useBucketVersioning, useUpdateVersioning } from "@/hooks/useBucketConfig";
import { showError } from "@/lib/toast";
import { useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const VersioningPanel = () => {
  const { t } = useTranslation();
  const accountId = useBucketConfigStore((state) => state.accountId);
  const bucket = useBucketConfigStore((state) => state.bucket);

  const {
    data: versioning,
    isFetching: loading,
    error: fetchError,
  } = useBucketVersioning(accountId!, bucket!);
  const updateMutation = useUpdateVersioning();

  const [status, setStatus] = useState<"Enabled" | "Suspended">("Suspended");

  useEffect(() => {
    setStatus((versioning?.status as "Enabled" | "Suspended") || "Suspended");
  }, [versioning?.status]);

  const handleSave = async () => {
    if (!accountId || !bucket) return;
    try {
      await updateMutation.mutateAsync({ accountId, bucket, status });
    } catch (e) {
      showError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const errorMessage = fetchError
    ? (fetchError as Error).message
    : updateMutation.error
      ? (updateMutation.error as Error).message
      : null;

  return (
    <div className="space-y-4">
      <header>
        <h3 className="text-xl font-semibold">{t("bucket.versioning.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bucket.versioning.description")}</p>
      </header>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
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
      <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bucket.versioning.save")}
      </Button>
    </div>
  );
};
