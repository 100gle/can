import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  bucketConfigStore,
  useBucketConfigStore,
  type BucketRefererModel,
} from "@/state/bucketConfig";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type RefererProtectionPanelProps = {
  provider: string;
};

export const RefererProtectionPanel = ({ provider }: RefererProtectionPanelProps) => {
  const { t } = useTranslation();
  const referer = useBucketConfigStore((state) => state.referer);
  const saving = useBucketConfigStore((state) => state.saving.referer);
  const [draft, setDraft] = useState<BucketRefererModel | undefined>(referer);

  useEffect(() => {
    setDraft(referer);
  }, [referer?.updated]);

  if (!draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("bucket.referer.title")}</CardTitle>
          <CardDescription>{t("common.loading")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSave = () => {
    const whitelist = draft.whitelist.map((item) => item.trim()).filter(Boolean);
    void bucketConfigStore.saveReferer({ ...draft, whitelist });
  };

  const textareaValue = draft.whitelist.join("\n");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("bucket.referer.title")}</CardTitle>
        <CardDescription>{t("bucket.referer.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-medium">{t("bucket.referer.enable")}</p>
            <p className="text-sm text-muted-foreground">{t("bucket.referer.enableDesc")}</p>
          </div>
          <Switch
            checked={draft.enabled}
            onCheckedChange={(value) =>
              setDraft((state) => (state ? { ...state, enabled: value } : state))
            }
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-medium">{t("bucket.referer.allowEmpty")}</p>
            <p className="text-sm text-muted-foreground">{t("bucket.referer.allowEmptyDesc")}</p>
          </div>
          <Switch
            checked={draft.allowEmpty}
            onCheckedChange={(value) =>
              setDraft((state) => (state ? { ...state, allowEmpty: value } : state))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>{t("bucket.referer.whitelist")}</Label>
          <Textarea
            rows={6}
            disabled={!draft.enabled}
            value={textareaValue}
            onChange={(event) =>
              setDraft((state) =>
                state
                  ? {
                      ...state,
                      whitelist: event.target.value.split("\n").map((item) => item.trim()),
                    }
                  : state,
              )
            }
            placeholder={t("bucket.referer.placeholder")}
          />
        </div>
        {provider === "aws" && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t("bucket.referer.awsHint")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setDraft(referer)}
            disabled={saving || referer === draft}
          >
            {t("bucket.referer.reset")}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("bucket.referer.saving") : t("bucket.referer.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
