import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isDesktopMode } from "@/lib/bridge";
import { cn, formatBytes } from "@/lib/utils";
import MonacoEditor from "@monaco-editor/react";
import {
  GetObjectAttributes,
  GetPresignedDownloadURLWithHeaders,
  GetPresignedUploadURL,
} from "@wailsjs/go/app/App";
import { objects as ObjectModels } from "@wailsjs/go/models";
import { AlertTriangle, Eye, Loader2, Maximize2, Minimize2, Pencil, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { offlineManager } from "@/lib/offline";
import { objectsStore } from "@/state/objects";
import { usePreferencesStore } from "@/state/preferences";

type FilePreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId?: string;
  bucket?: string;
  object?: ObjectModels.ObjectInfo;
};

type PreviewKind = "image" | "text" | "markdown" | "video" | "audio" | "pdf" | "unsupported";

const MAX_INLINE_SIZE = 5 * 1024 * 1024; // 5MB
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "yaml",
  "yml",
  "xml",
  "ini",
  "conf",
  "cfg",
  "log",
  "env",
  "js",
  "jsx",
  "ts",
  "tsx",
  "css",
  "scss",
  "sass",
  "less",
  "html",
  "htm",
  "sql",
  "go",
  "py",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "h",
  "cpp",
  "hpp",
  "sh",
  "bat",
  "dockerfile",
  "properties",
]);
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"];
const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "mkv"];
const AUDIO_EXTENSIONS = ["mp3", "wav", "aac", "ogg", "flac"];
const PDF_EXTENSIONS = ["pdf"];
const MARKDOWN_EXTENSIONS = ["md", "markdown"];

const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  go: "go",
  py: "python",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  swift: "swift",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  sql: "sql",
  sh: "shell",
};

const textEncoder = new TextEncoder();

export function FilePreviewModal({
  open,
  onOpenChange,
  accountId,
  bucket,
  object,
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [editorValue, setEditorValue] = useState("");
  const [mode, setMode] = useState<"preview" | "edit">("preview");
  const [error, setError] = useState<string | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string>("text/plain; charset=utf-8");
  const [attributesLoaded, setAttributesLoaded] = useState(false);
  const [textTooLarge, setTextTooLarge] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileName = object?.key.split("/").filter(Boolean).pop() ?? "object";
  const extension = useMemo(() => fileName.split(".").pop()?.toLowerCase() ?? "", [fileName]);

  const previewKind: PreviewKind = useMemo(() => {
    if (!object) return "unsupported";
    if (object.isDir) return "unsupported";
    if (IMAGE_EXTENSIONS.includes(extension)) return "image";
    if (MARKDOWN_EXTENSIONS.includes(extension)) return "markdown";
    if (TEXT_EXTENSIONS.has(extension)) return "text";
    if (VIDEO_EXTENSIONS.includes(extension)) return "video";
    if (AUDIO_EXTENSIONS.includes(extension)) return "audio";
    if (PDF_EXTENSIONS.includes(extension)) return "pdf";
    return "unsupported";
  }, [object, extension]);

  const language = LANGUAGE_MAP[extension] ?? "plaintext";

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    if (!isDesktopMode()) {
      setError("Bridge 未就绪，无法生成预览链接");
      return;
    }
    if (!accountId || !bucket || !object) {
      setError("请选择账户与对象后再尝试预览");
      return;
    }
    if (object.isDir) {
      setError("暂不支持预览文件夹");
      return;
    }
    if (
      object.size &&
      object.size > MAX_INLINE_SIZE &&
      (previewKind === "text" || previewKind === "markdown")
    ) {
      setTextTooLarge(true);
      setError(`文件超过 ${(MAX_INLINE_SIZE / (1024 * 1024)).toFixed(0)}MB，建议直接下载查看。`);
      return;
    }
    void loadPreview(accountId, bucket, object.key);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId, bucket, object?.key]);

  const resetState = () => {
    setPreviewUrl(null);
    setTextContent("");
    setEditorValue("");
    setMode("preview");
    setError(null);
    setEtag(null);
    setAttributesLoaded(false);
    setTextTooLarge(false);
    setIsFromCache(false);
  };

  const loadPreview = async (account: string, bucketName: string, key: string) => {
    setLoading(true);
    setError(null);
    setIsFromCache(false);
    const offlineEnabled = usePreferencesStore.getState().offlineCacheEnabled;
    try {
      const headers = { "content-disposition": "inline" };
      const supportsOfflineText =
        offlineEnabled && (previewKind === "text" || previewKind === "markdown");

      if (supportsOfflineText) {
        let latestUrl: string | null = null;
        const result = await offlineManager.getFileContent(
          { accountId: account, bucket: bucketName, key },
          async () => {
            const [url, attrs] = await Promise.all([
              GetPresignedDownloadURLWithHeaders(account, bucketName, key, 10, headers),
              GetObjectAttributes(account, bucketName, key),
            ]);
            latestUrl = url;
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error("加载文本内容失败");
            }
            const text = await response.text();
            const contentTypeValue =
              attrs.object.contentType || contentTypeFromExtension(extension);
            setAttributesLoaded(true);
            return {
              content: text,
              contentType: contentTypeValue,
              etag: attrs.object.etag || undefined,
            };
          },
        );

        if (typeof result.content === "string") {
          setTextContent(result.content);
          setEditorValue(result.content);
        }
        setContentType(result.contentType);
        setEtag(result.etag || null);
        setAttributesLoaded(true);
        setIsFromCache(result.source === "cache");
        setPreviewUrl(latestUrl);
        return;
      }

      // 1. Get URL first (Critical)
      const url = await GetPresignedDownloadURLWithHeaders(account, bucketName, key, 10, headers);
      setPreviewUrl(url);

      // 2. Try get attributes (Optional - for metadata display)
      try {
        const attrs = await GetObjectAttributes(account, bucketName, key);
        setEtag(attrs.object.etag || null);
        setContentType(attrs.object.contentType || contentTypeFromExtension(extension));
        setAttributesLoaded(true);
      } catch (attrErr) {
        console.warn("Failed to load object attributes:", attrErr);
        // Fallback: use extension for content type
        setContentType(contentTypeFromExtension(extension));
        setEtag(null);
        setAttributesLoaded(true); // Still mark as loaded to allow basic display
      }

      if (previewKind === "text" || previewKind === "markdown") {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("加载文本内容失败");
        }
        const text = await response.text();
        setTextContent(text);
        setEditorValue(text);
      }
    } catch (err) {
      console.error("Preview load failed:", err);
      const message = err instanceof Error ? err.message : "加载预览失败";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!accountId || !bucket || !object) return;
    if (!attributesLoaded) {
      toast.error("尚未加载对象元数据，无法保存。");
      return;
    }
    if (isFromCache) {
      toast.error("离线副本无法保存，请恢复网络后重试。");
      return;
    }
    if (mode !== "edit") {
      setMode("edit");
      return;
    }
    if (textTooLarge) {
      toast.error("文件过大，暂不支持在线保存。");
      return;
    }
    try {
      setSaving(true);
      // Conflict detection
      const latest = await GetObjectAttributes(accountId, bucket, object.key);
      if (etag && latest.object.etag && etag !== latest.object.etag) {
        toast.error("对象已被其他人修改，请刷新后再试。");
        setEtag(latest.object.etag || null);
        setContentType(latest.object.contentType || contentTypeFromExtension(extension));
        await loadPreview(accountId, bucket, object.key);
        setMode("preview");
        return;
      }
      const uploadURL = await GetPresignedUploadURL(accountId, bucket, object.key, 10);
      const payload = textEncoder.encode(editorValue ?? "");
      const response = await fetch(uploadURL, {
        method: "PUT",
        body: payload,
      });
      if (!response.ok) {
        throw new Error(`保存失败，状态码 ${response.status}`);
      }

      // Try to restore original content-type if available
      if (contentType) {
        void objectsStore.updateObjectAttributes({
          bucket,
          key: object.key,
          contentType,
        } as ObjectModels.ObjectAttributesPatch);
      }
      await loadPreview(accountId, bucket, object.key);
      toast.success("保存成功");
      setMode("preview");
      void objectsStore.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败，请稍后重试";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const renderPreviewPane = () => {
    if (loading) {
      return (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载预览中...
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p>{error}</p>
        </div>
      );
    }
    if (!previewUrl && !error) {
      // Placeholder state when waiting for URL generation or before loading starts
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/10 rounded-md border border-border/40">
          <div className="h-10 w-10 animate-pulse rounded-full bg-muted/20" />
          <p className="text-sm animate-pulse">准备预览中...</p>
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          暂无可用预览。
        </div>
      );
    }

    switch (previewKind) {
      case "image":
        return (
          <div
            className={cn(
              "relative flex items-center justify-center rounded-md border border-border/60 bg-muted/20 p-4 overflow-hidden group",
              isFullscreen ? "h-[calc(100vh-180px)]" : "max-h-[50vh]",
            )}
          >
            <img
              src={previewUrl}
              alt={fileName}
              className={cn(
                "rounded-md object-contain",
                isFullscreen ? "max-h-full max-w-full" : "max-h-[45vh] max-w-full",
              )}
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "退出全屏" : "全屏预览"}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        );
      case "video":
        return (
          <video
            controls
            src={previewUrl}
            className="h-[60vh] w-full rounded-md border border-border/60"
          />
        );
      case "audio":
        return (
          <div className="flex flex-col items-center gap-4 rounded-md border border-border/60 p-6">
            <audio controls src={previewUrl} className="w-full" />
          </div>
        );
      case "pdf":
        return (
          <iframe
            title="pdf-preview"
            src={previewUrl}
            className="h-[60vh] w-full rounded-md border border-border/60"
          />
        );
      case "markdown":
        if (mode === "edit") {
          return (
            <MonacoEditor
              height="60vh"
              theme="vs-dark"
              language={language}
              value={editorValue}
              onChange={(value) => setEditorValue(value ?? "")}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: 14,
              }}
            />
          );
        }
        return (
          <Tabs defaultValue="rendered" className="w-full">
            <TabsList className="grid w-60 grid-cols-2">
              <TabsTrigger value="rendered">渲染</TabsTrigger>
              <TabsTrigger value="source">源代码</TabsTrigger>
            </TabsList>
            <TabsContent value="rendered">
              <div className="h-[55vh] overflow-y-auto rounded-md border border-border/60 bg-card p-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  className="prose dark:prose-invert max-w-none"
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            </TabsContent>
            <TabsContent value="source">
              <MonacoEditor
                height="55vh"
                theme="vs-dark"
                language={language}
                value={textContent}
                options={{ readOnly: true }}
              />
            </TabsContent>
          </Tabs>
        );
      case "text":
        return (
          <MonacoEditor
            height="60vh"
            theme="vs-dark"
            language={language}
            value={mode === "edit" ? editorValue : textContent}
            onChange={(value) => mode === "edit" && setEditorValue(value ?? "")}
            options={{
              readOnly: mode !== "edit",
              minimap: { enabled: false },
              fontSize: 14,
            }}
          />
        );
      default:
        return (
          <div className="flex flex-col items-center gap-2 rounded-md border border-border/60 p-10 text-center text-sm text-muted-foreground">
            <Eye className="h-6 w-6 text-muted-foreground/80" />
            暂不支持此文件类型的内联预览，请直接下载。
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-4 flex flex-col",
          isFullscreen ? "max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]" : "max-w-4xl max-h-[90vh]",
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between text-base">
            <span className="truncate">{fileName}</span>
            {object?.size !== undefined && (
              <span className="text-xs text-muted-foreground">{formatBytes(object.size)}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!isDesktopMode() ? (
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
            桌面 Bridge 未就绪，无法生成预览。请启动核心应用或在桌面模式下使用。
          </div>
        ) : (
          <>
            {renderPreviewPane()}

            <div className="grid gap-4 rounded-md border border-border/60 p-4 text-sm relative">
              {isFromCache && (
                <Badge variant="default" className="absolute right-2 top-2">
                  离线副本
                </Badge>
              )}
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">存储桶</Label>
                  <Input value={bucket ?? ""} readOnly />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">完整 Key</Label>
                  <Input value={object?.key ?? ""} readOnly className="font-mono text-xs" />
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Content-Type</Label>
                  <Input value={contentType} readOnly />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">ETag</Label>
                  <Input value={etag ?? "-"} readOnly className="font-mono text-xs" />
                </div>
              </div>
            </div>
          </>
        )}

        <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {object?.isSymlink && object.symlinkTarget && (
              <span className="rounded-full border border-dashed border-border/70 px-2 py-0.5 text-xs">
                Symlink → {object.symlinkTarget}
              </span>
            )}
            {object?.lastModified && (
              <span>更新于 {new Date(object.lastModified).toLocaleString()}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
            {previewKind === "text" || previewKind === "markdown" ? (
              <Button
                variant={mode === "edit" ? "default" : "outline"}
                onClick={handleSave}
                disabled={saving || loading || !attributesLoaded}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 保存中
                  </>
                ) : mode === "edit" ? (
                  <>
                    <Save className="mr-2 h-4 w-4" /> 保存修改
                  </>
                ) : (
                  <>
                    <Pencil className="mr-2 h-4 w-4" /> 进入编辑
                  </>
                )}
              </Button>
            ) : null}
            {previewUrl && (
              <Button asChild>
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  下载原文件
                </a>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const contentTypeFromExtension = (ext: string): string => {
  if (IMAGE_EXTENSIONS.includes(ext)) return `image/${ext === "svg" ? "svg+xml" : ext}`;
  if (ext === "json") return "application/json";
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "yaml" || ext === "yml") return "application/yaml";
  if (ext === "txt") return "text/plain; charset=utf-8";
  if (ext === "js") return "application/javascript";
  if (ext === "ts") return "text/typescript";
  if (ext === "css") return "text/css";
  if (PDF_EXTENSIONS.includes(ext)) return "application/pdf";
  return "application/octet-stream";
};
