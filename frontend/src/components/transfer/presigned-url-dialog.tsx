import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isBridgeAvailable } from "@/lib/bridge";
import { GetPresignedDownloadURL, GetPresignedUploadURL } from "@wailsjs/go/main/App";
import { Copy, Loader2, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>生成{modeLabel}链接</DialogTitle>
          <DialogDescription>
            {bucket ? `${bucket} · ${objectKey}` : "请选择对象后再生成链接"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">有效期</Label>
            <div className="flex flex-wrap gap-2">
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
              <Input
                type="number"
                min={1}
                placeholder="自定义(分钟)"
                value={custom}
                onChange={(event) => setCustom(event.target.value)}
                className="w-32"
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            生成的链接可直接用于 {modeLabel}。请谨慎分享，权限将在到期后自动失效。
          </p>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {link ? (
            <div className="space-y-2">
              <Label htmlFor="presigned-link">链接</Label>
              <Textarea id="presigned-link" value={link} readOnly rows={3} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                  复制
                </Button>
                <Button asChild variant="ghost" size="sm" className="gap-2">
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center"
                  >
                    <Share2 className="h-4 w-4" />
                    打开链接
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleGenerate} disabled={loading || !bridgeReady}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            生成链接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
