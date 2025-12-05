import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GetPresignedDownloadURL, GetPresignedUploadURL } from "../../../wailsjs/go/main/App";
import { isBridgeAvailable } from "@/lib/bridge";

type PresignedURLDialogProps = {
  open: boolean;
  mode: "download" | "upload";
  accountId?: string;
  bucket?: string;
  objectKey?: string;
  onClose: () => void;
};

const presets = [
  { label: "1 小时", minutes: 60 },
  { label: "1 天", minutes: 60 * 24 },
  { label: "7 天", minutes: 60 * 24 * 7 },
];

export const PresignedURLDialog = ({
  open,
  mode,
  accountId,
  bucket,
  objectKey,
  onClose,
}: PresignedURLDialogProps) => {
  const [minutes, setMinutes] = useState(60);
  const [custom, setCustom] = useState("");
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const bridgeReady = isBridgeAvailable();

  useEffect(() => {
    if (!open) {
      setMinutes(60);
      setCustom("");
      setLink("");
      setError(undefined);
    }
  }, [open]);

  const resolvedMinutes = useMemo(() => {
    if (!custom.trim()) return minutes;
    const parsed = Number.parseInt(custom, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return minutes;
    return parsed;
  }, [custom, minutes]);

  const modeLabel = mode === "download" ? "下载" : "上传";

  const handleGenerate = async () => {
    if (!bridgeReady) {
      setError("Bridge 未就绪，无法生成链接");
      return;
    }
    if (!accountId || !bucket || !objectKey) {
      setError("缺少账户、Bucket 或对象信息");
      return;
    }
    setLoading(true);
    setError(undefined);
    setLink("");
    try {
      const fn = mode === "download" ? GetPresignedDownloadURL : GetPresignedUploadURL;
      const url = await fn(accountId, bucket, objectKey, resolvedMinutes);
      setLink(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成链接失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.alert?.("复制失败，请手动复制链接。");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-border/40 bg-background p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">预签名链接</p>
            <h3 className="text-xl font-semibold">生成{modeLabel}链接</h3>
            <p className="text-sm text-muted-foreground">
              {bucket ? `${bucket} · ${objectKey}` : "请选择对象"}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">有效期</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.minutes}
                  type="button"
                  size="sm"
                  variant={minutes === preset.minutes && !custom ? "default" : "outline"}
                  onClick={() => {
                    setMinutes(preset.minutes);
                    setCustom("");
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <input
                type="number"
                placeholder="自定义(分钟)"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                className="h-9 w-32 rounded-lg border border-border/60 bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              生成的链接可直接用于 {modeLabel}。请谨慎分享，{modeLabel}权限将在到期后自动失效。
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {link ? (
            <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">链接</p>
              <p className="line-clamp-2 break-all text-sm text-foreground">{link}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                  复制
                </Button>
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2 text-sm transition hover:bg-accent",
                  )}
                >
                  <Share2 className="h-4 w-4" />
                  打开链接
                </a>
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleGenerate} disabled={loading || !bridgeReady}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              生成链接
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
