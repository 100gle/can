import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bucketConfigStore, useBucketConfigStore } from "@/state/bucketConfig";

export const EncryptionPanel = () => {
  const encryption = useBucketConfigStore((state) => state.encryption);
  const saving = useBucketConfigStore((state) => state.saving.encryption);
  const [enabled, setEnabled] = useState(false);
  const [algorithm, setAlgorithm] = useState<"AES256" | "aws:kms">("AES256");
  const [kmsKeyId, setKmsKeyId] = useState("");

  useEffect(() => {
    setEnabled(Boolean(encryption?.enabled));
    setAlgorithm((encryption?.algorithm?.toUpperCase() === "AWS:KMS" ? "aws:kms" : "AES256") as
      | "AES256"
      | "aws:kms");
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
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="h-4 w-4"
        />
        启用默认加密
      </label>
      {enabled ? (
        <div className="space-y-3 rounded-lg border border-border/50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            算法：
            <select
              value={algorithm}
              onChange={(event) => setAlgorithm(event.target.value as "AES256" | "aws:kms")}
              className="rounded-md border border-border/50 bg-background px-3 py-1 text-sm"
            >
              <option value="AES256">SSE-S3 (AES256)</option>
              <option value="aws:kms">SSE-KMS (aws:kms)</option>
            </select>
          </label>
          {algorithm === "aws:kms" ? (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">KMS Key ID</label>
              <input
                value={kmsKeyId}
                onChange={(event) => setKmsKeyId(event.target.value)}
                className="rounded-md border border-border/50 bg-background px-3 py-2 text-sm"
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
