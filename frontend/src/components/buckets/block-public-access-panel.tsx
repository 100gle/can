import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { usePublicAccessBlock, useUpdatePublicAccessBlock } from "@/hooks/useBucketConfig";
import { showError } from "@/lib/toast";
import { useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const BlockPublicAccessPanel = () => {
  const { t } = useTranslation();
  const accountId = useBucketConfigStore((state) => state.accountId);
  const bucket = useBucketConfigStore((state) => state.bucket);

  const { data: publicAccessBlock } = usePublicAccessBlock(accountId!, bucket!);
  const updateMutation = useUpdatePublicAccessBlock();

  const [settings, setSettings] = useState({
    blockPublicAcls: true,
    ignorePublicAcls: true,
    blockPublicPolicy: true,
    restrictPublicBuckets: true,
  });

  useEffect(() => {
    if (publicAccessBlock) {
      setSettings(publicAccessBlock);
    }
  }, [publicAccessBlock]);

  const toggle = (key: keyof typeof settings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  const handleSave = async () => {
    if (!accountId || !bucket) return;
    try {
      await updateMutation.mutateAsync({ accountId, bucket, block: settings });
    } catch (e) {
      showError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-xl font-semibold">{t("bucket.publicAccess.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bucket.publicAccess.description")}</p>
      </header>
      <div className="space-y-4 rounded-lg border border-border/50 p-4">
        {["blockPublicAcls", "ignorePublicAcls", "blockPublicPolicy", "restrictPublicBuckets"].map(
          (key) => (
            <div key={key} className="flex items-start space-x-3">
              <Checkbox
                id={key}
                checked={settings[key as keyof typeof settings]}
                onCheckedChange={() => toggle(key as keyof typeof settings)}
              />
              <div className="space-y-1">
                <Label htmlFor={key} className="font-medium">
                  {t(`bucket.publicAccess.${key}`)}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t(`bucket.publicAccess.${key}Desc`)}
                </p>
              </div>
            </div>
          ),
        )}
      </div>
      <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bucket.publicAccess.save")}
      </Button>
    </div>
  );
};
