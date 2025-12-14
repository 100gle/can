import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  bucketConfigStore,
  useBucketConfigStore,
  type PublicAccessBlockModel,
} from "@/state/bucketConfig";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type BlockPublicAccessPanelProps = {
  provider: string;
};

const TOGGLES: Array<{
  key: keyof PublicAccessBlockModel;
}> = [
  {
    key: "blockPublicAcls",
  },
  {
    key: "ignorePublicAcls",
  },
  {
    key: "blockPublicPolicy",
  },
  {
    key: "restrictPublicBuckets",
  },
];

export const BlockPublicAccessPanel = ({ provider }: BlockPublicAccessPanelProps) => {
  const { t } = useTranslation();
  const block = useBucketConfigStore((state) => state.publicAccessBlock);
  const saving = useBucketConfigStore((state) => state.saving.publicAccess);
  const [draft, setDraft] = useState<PublicAccessBlockModel | undefined>(block);

  useEffect(() => {
    setDraft(block);
  }, [block]);

  if (!draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("bucket.publicAccess.title")}</CardTitle>
          <CardDescription>{t("common.loading")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleToggle = (key: keyof PublicAccessBlockModel, value: boolean) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const handleSave = () => {
    void bucketConfigStore.savePublicAccessBlock(draft);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("bucket.publicAccess.title")}</CardTitle>
        <CardDescription>{t("bucket.publicAccess.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {TOGGLES.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-4 rounded-xl border p-4"
          >
            <div>
              <p className="font-medium">{t(`bucket.publicAccess.${item.key}`)}</p>
              <p className="text-sm text-muted-foreground">
                {t(`bucket.publicAccess.${item.key}Desc`)}
              </p>
            </div>
            <Switch
              checked={draft[item.key]}
              onCheckedChange={(value) => handleToggle(item.key, value)}
            />
          </div>
        ))}
        {provider !== "aws" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t("bucket.publicAccess.providerHint", { provider: provider.toUpperCase() })}
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("bucket.publicAccess.saving") : t("bucket.publicAccess.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
