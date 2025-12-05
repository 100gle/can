import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { bucketConfigStore, useBucketConfigStore } from "@/state/bucketConfig";

export const EncryptionPanel = () => {
  const encryption = useBucketConfigStore((state) => state.encryption);
  const saving = useBucketConfigStore((state) => state.saving.encryption);
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
  }, [encryption?.enabled, encryption?.algorithm, encryption?.kmsKeyId]);

  const handleSave = () => {
    void bucketConfigStore.saveEncryption({
      enabled,
      algorithm,
      kmsKeyId,
      updated: new Date().toISOString() as any,
    });
  };

  return (
    <div className="space-y-4">
      <header>
        <h3 className="text-xl font-semibold">默认加密</h3>
        <p className="text-sm text-muted-foreground">
          为所有新对象启用默认的服务器端加密。可以选择 S3 托管密钥或 KMS 自定义密钥。
        </p>
      </header>
      <div className="flex items-center justify-between rounded-xl border border-border/60 p-4">
        <div>
          <p className="font-medium">启用默认加密</p>
          <p className="text-sm text-muted-foreground">为所有新对象自动应用服务器端加密。</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="切换默认加密" />
      </div>
      {enabled ? (
        <div className="space-y-3 rounded-lg border border-border/50 p-4">
          <div className="space-y-2">
            <Label>算法</Label>
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
          {algorithm === "aws:kms" ? (
            <div className="space-y-2">
              <Label htmlFor="kms-key">KMS Key ID</Label>
              <Input
                id="kms-key"
                value={kmsKeyId}
                onChange={(event) => setKmsKeyId(event.target.value)}
                placeholder="arn:aws:kms:region:acct:key/..."
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <Button onClick={handleSave} disabled={Boolean(saving)} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        保存
      </Button>
    </div>
  );
};
