import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { isDesktopMode } from "@/lib/bridge";
import { GenerateAccessLinks } from "@wailsjs/go/app/App";
import { objects } from "@wailsjs/go/models";
import { Clipboard, Loader2, QrCode, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SecurityTips } from "./security-tips";

type HeaderEntry = { id: string; key: string; value: string };

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 8);
};

type PresignedURLDialogProps = {
  open: boolean;
  mode: "download" | "upload";
  accountId?: string;
  bucket?: string;
  objectKey?: string;
  onClose: () => void;
};

export const PresignedURLDialog = ({
  open,
  mode,
  accountId,
  bucket,
  objectKey,
  onClose,
}: PresignedURLDialogProps) => {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState(60);
  const [custom, setCustom] = useState("");
  // AccessLinkRequest has: ExpiryMinutes, CustomHeaders, ContentDisposition, Method. No password yet.

  const [method, setMethod] = useState("GET");
  const [filename, setFilename] = useState("");
  const [headerEntries, setHeaderEntries] = useState<HeaderEntry[]>([
    { id: createId(), key: "", value: "" },
  ]);

  const [generatedLink, setGeneratedLink] = useState<objects.AccessLink | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const bridgeReady = isDesktopMode();

  useEffect(() => {
    if (!open) {
      setMinutes(60);
      setCustom("");
      setGeneratedLink(null);
      setError(undefined);
      setMethod(mode === "upload" ? "PUT" : "GET");
      setFilename("");
      setHeaderEntries([{ id: createId(), key: "", value: "" }]);
    } else {
      setMethod(mode === "upload" ? "PUT" : "GET");
    }
  }, [open, mode]);

  const resolvedMinutes = useMemo(() => {
    if (!custom.trim()) return minutes;
    const parsed = Number.parseInt(custom, 10);
    if (Number.isNaN(parsed) || parsed <= 0) return minutes;
    return parsed;
  }, [custom, minutes]);

  const handleGenerate = async () => {
    if (!bridgeReady || !accountId || !bucket || !objectKey) return;
    setLoading(true);
    setError(undefined);
    try {
      const responseHeaders = headerEntries.reduce<Record<string, string>>((acc, entry) => {
        const key = entry.key.trim();
        const value = entry.value.trim();
        if (!key || !value) return acc;
        acc[key] = value;
        return acc;
      }, {});
      const request = {
        bucket,
        key: objectKey,
        methods: [method],
        expirationSeconds: resolvedMinutes * 60,
        responseHeaders,
        fileName: filename,
      } as objects.AccessLinkRequest;
      const result = await GenerateAccessLinks(accountId, request);
      // Backend returns array of AccessLink
      if (Array.isArray(result) && result.length > 0) {
        setGeneratedLink(result[0]);
      } else if (!Array.isArray(result)) {
        // Fallback if types lied and it returns single object
        setGeneratedLink(result as any);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("presigned.error.failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const presets = [
    { label: t("presigned.duration.1hour"), minutes: 60 },
    { label: t("presigned.duration.1day"), minutes: 60 * 24 },
    { label: t("presigned.duration.7days"), minutes: 60 * 24 * 7 },
    { label: t("presigned.duration.30days"), minutes: 60 * 24 * 30 },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{t("presigned.title")}</DialogTitle>
            </div>
            <div className="text-sm text-muted-foreground truncate max-w-lg">
              {bucket}/{objectKey}
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Settings */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("presigned.label.expiry")}</Label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <Button
                      key={preset.minutes}
                      variant={minutes === preset.minutes && !custom ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setMinutes(preset.minutes);
                        setCustom("");
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t("presigned.label.customDuration")}
                    type="number"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    className="h-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("presigned.label.method")}</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">{t("presigned.method.get")}</SelectItem>
                    <SelectItem value="PUT">{t("presigned.method.put")}</SelectItem>
                    <SelectItem value="HEAD">HEAD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {mode === "download" && (
                <div className="space-y-2">
                  <Label>{t("presigned.label.filename")}</Label>
                  <Input
                    placeholder={t("presigned.placeholder.filename")}
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="h-8"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("presigned.label.headers")}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setHeaderEntries((entries) => [
                        ...entries,
                        { id: createId(), key: "", value: "" },
                      ])
                    }
                  >
                    {t("presigned.button.addHeader")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("presigned.headers.desc")}</p>
                <div className="space-y-2">
                  {headerEntries.map((entry, index) => (
                    <div key={entry.id} className="flex items-center gap-2">
                      <Input
                        placeholder={t("presigned.placeholder.headerKey")}
                        value={entry.key}
                        onChange={(e) =>
                          setHeaderEntries((entries) =>
                            entries.map((item) =>
                              item.id === entry.id ? { ...item, key: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <Input
                        placeholder={t("presigned.placeholder.headerValue")}
                        value={entry.value}
                        onChange={(e) =>
                          setHeaderEntries((entries) =>
                            entries.map((item) =>
                              item.id === entry.id ? { ...item, value: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          setHeaderEntries((entries) =>
                            entries.length === 1
                              ? entries
                              : entries.filter((item) => item.id !== entry.id),
                          )
                        }
                        disabled={headerEntries.length === 1 && index === 0}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={handleGenerate} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("presigned.button.generate")}
              </Button>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            {/* Right Column: Result */}
            <div className="rounded-lg border bg-muted/30 p-4 min-h-[300px]">
              {!generatedLink ? (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
                  <QrCode className="h-12 w-12 opacity-20" />
                  <span className="text-sm">{t("presigned.empty")}</span>
                </div>
              ) : (
                <Tabs defaultValue="url" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="url">URL</TabsTrigger>
                    <TabsTrigger value="md">Markdown</TabsTrigger>
                    <TabsTrigger value="html">HTML</TabsTrigger>
                  </TabsList>

                  <TabsContent value="url" className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={generatedLink.url}
                        readOnly
                        className="h-24 pr-10 resize-none font-mono text-xs"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1 h-6 w-6"
                        onClick={() => handleCopy(generatedLink.url)}
                      >
                        <Clipboard className="h-3 w-3" />
                      </Button>
                    </div>
                    {generatedLink.qrCode && (
                      <div className="flex justify-center p-2 bg-white rounded-md border w-fit mx-auto">
                        <img
                          src={`data:image/png;base64,${generatedLink.qrCode}`}
                          alt="QR Code"
                          className="w-32 h-32"
                        />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="md" className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={generatedLink.markdown}
                        readOnly
                        className="h-32 pr-10 resize-none font-mono text-xs"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1 h-6 w-6"
                        onClick={() => handleCopy(generatedLink.markdown)}
                      >
                        <Clipboard className="h-3 w-3" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="html" className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={generatedLink.html}
                        readOnly
                        className="h-32 pr-10 resize-none font-mono text-xs"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-1 top-1 h-6 w-6"
                        onClick={() => handleCopy(generatedLink.html)}
                      >
                        <Clipboard className="h-3 w-3" />
                      </Button>
                    </div>
                  </TabsContent>

                  <div className="text-xs text-muted-foreground text-center mt-2">
                    {t("presigned.expiry.notice", { minutes: resolvedMinutes })}
                  </div>
                </Tabs>
              )}

              {/* Security Tips - always shown */}
              <SecurityTips className="mt-4 pt-4 border-t border-border/40" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
