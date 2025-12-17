import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useBucketEncryption, useUpdateEncryption } from "@/hooks/useBucketConfig";
import { showError } from "@/lib/toast";
import { useBucketConfigStore } from "@/state/bucketConfig";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const EncryptionPanel = () => {
  const { t } = useTranslation();
  const accountId = useBucketConfigStore((state) => state.accountId);
  const bucket = useBucketConfigStore((state) => state.bucket);

  const { data: encryption } = useBucketEncryption(accountId!, bucket!);
  const updateMutation = useUpdateEncryption();

  const [enabled, setEnabled] = useState(false);
  const [algorithm, setAlgorithm] = useState<"AES256" | "aws:kms">("AES256");
  const [kmsKeyId, setKmsKeyId] = useState("");

  useEffect(() => {
    setEnabled(Boolean(encryption?.enabled));
    setAlgorithm(
      (encryption?.algorithm?.toUpperCase() === "AWS:KMS" ? "aws:kms" : "AES256") as
        | "AES256"
        | "aws:kms",
    );
    setKmsKeyId(encryption?.kmsKeyId ?? "");
  }, [encryption]);

  const handleSave = async () => {
    if (!accountId || !bucket) return;
    try {
      await updateMutation.mutateAsync({
        accountId,
        bucket,
        config: {
          enabled,
          algorithm,
          kmsKeyId,
          updated: new Date().toISOString(),
        },
      });
    } catch (e) {
      showError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h3 className="text-xl font-semibold">{t("bucket.encryption.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("bucket.encryption.description")}</p>
      </header>
      <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
        <div>
          <p className="font-medium">{t("bucket.encryption.enable")}</p>
          <p className="text-sm text-muted-foreground">{t("bucket.encryption.enableDesc")}</p>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={setEnabled}
          aria-label={t("bucket.encryption.switchAria")}
        />
      </div>
      {enabled && (
        <div className="space-y-3 rounded-lg border border-border/50 p-4">
          <div className="space-y-2">
            <Label>{t("bucket.encryption.algorithm")}</Label>
            <Select
              value={algorithm}
              onValueChange={(value) => setAlgorithm(value as "AES256" | "aws:kms")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AES256">SSE-S3 (AES256)</SelectItem>
                <SelectItem value="aws:kms">SSE-KMS (aws:kms)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {algorithm === "aws:kms" && (
            <div className="space-y-2">
              <Label htmlFor="kms-key">KMS Key ID</Label>
              <Input
                id="kms-key"
                value={kmsKeyId}
                onChange={(event) => setKmsKeyId(event.target.value)}
                placeholder={t("bucket.encryption.kmsKeyIdPlaceholder")}
              />
            </div>
          )}
        </div>
      )}
      <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
        {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t("bucket.encryption.save")}
      </Button>
    </div>
  );
};
