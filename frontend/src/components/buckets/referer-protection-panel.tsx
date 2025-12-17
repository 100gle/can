import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useBucketReferer, useUpdateReferer } from "@/hooks/useBucketConfig";
import { showError } from "@/lib/toast";
import { useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const RefererProtectionPanel = () => {
  const { t } = useTranslation();
  const accountId = useBucketConfigStore((state) => state.accountId);
  const bucket = useBucketConfigStore((state) => state.bucket);

  const { data: referer } = useBucketReferer(accountId!, bucket!);
  const updateMutation = useUpdateReferer();

  const [enabled, setEnabled] = useState(false);
  const [allowEmpty, setAllowEmpty] = useState(true);
  const [whitelist, setWhitelist] = useState("");
  const [mode, setMode] = useState<"white-list" | "black-list">("white-list");

  useEffect(() => {
    if (referer) {
      setEnabled(referer.enabled);
      setAllowEmpty(referer.allowEmpty);
      setWhitelist(referer.whitelist.join("\n"));
      setMode((referer.mode as "white-list" | "black-list") || "white-list");
    }
  }, [referer]);

  const handleSave = async () => {
    if (!accountId || !bucket) return;
    try {
      const config = {
        enabled,
        allowEmpty,
        whitelist: whitelist
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        mode,
      };
      await updateMutation.mutateAsync({ accountId, bucket, config });
    } catch (e) {
      showError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h3 className="text-xl font-semibold">{t("bucket.referer.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bucket.referer.description")}</p>
      </header>

      <div className="flex items-center space-x-2">
        <Checkbox id="enable-referer" checked={enabled} onCheckedChange={(v) => setEnabled(!!v)} />
        <Label htmlFor="enable-referer">{t("bucket.referer.enable")}</Label>
      </div>

      {enabled && (
        <div className="space-y-4 rounded-lg border border-border/50 p-4">
          <div className="space-y-3">
            <Label>{t("bucket.referer.mode")}</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as "white-list" | "black-list")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="white-list" id="mode-whitelist" />
                <Label htmlFor="mode-whitelist">{t("bucket.referer.modeWhitelist")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="black-list" id="mode-blacklist" />
                <Label htmlFor="mode-blacklist">{t("bucket.referer.modeBlacklist")}</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>{t("bucket.referer.whitelist")}</Label>
            <Textarea
              placeholder="http://www.example.com"
              value={whitelist}
              onChange={(e) => setWhitelist(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">{t("bucket.referer.whitelistHint")}</p>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="allow-empty"
              checked={allowEmpty}
              onCheckedChange={(v) => setAllowEmpty(!!v)}
            />
            <Label htmlFor="allow-empty">{t("bucket.referer.allowEmpty")}</Label>
          </div>
        </div>
      )}

      <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bucket.referer.save")}
      </Button>
    </div>
  );
};
