import { ProviderIcon } from "@/components/common/provider-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DownloadImportTemplate, ImportAccounts, ImportAccountsBatch } from "@wailsjs/go/app/App";
import type { accounts } from "@wailsjs/go/models";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileArchive,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type ImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type DialogView = "select" | "batch";
type BatchFormat = "csv" | "json";
type ImportState = "idle" | "importing" | "done";

type ImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  errors?: accounts.BatchImportError[];
};

// Provider 配置
const PROVIDERS = [
  { id: "aws", label: "AWS S3" },
  { id: "oss", label: "Aliyun OSS" },
  { id: "cos", label: "Tencent COS" },
  { id: "r2", label: "Cloudflare R2" },
  { id: "qiniu", label: "Qiniu" },
  { id: "minio", label: "MinIO" },
  { id: "custom", label: "Custom" },
];

// CSV 模板示例
const CSV_EXAMPLE = `name,provider,endpoint,accessKeyId,secretAccessKey,tag,region,useSSL,port
"我的 AWS 账户",aws,s3.amazonaws.com,AKIAEXAMPLE,secretKey,"生产",us-east-1,true,443
"阿里云 OSS",oss,oss-cn-hangzhou.aliyuncs.com,LTAI5t,secretKey,"",cn-hangzhou,true,443`;

// JSON 模板示例（JSONC 格式，包含注释）
const JSON_EXAMPLE = `[
  {
    "name": "我的 AWS 账户",
    "provider": "aws",
    "endpoint": "s3.amazonaws.com",
    "accessKeyId": "AKIAEXAMPLE",
    "secretAccessKey": "secretKey123",
    "tag": "生产",
    "region": "us-east-1",
    "useSSL": true,
    "port": 443
  },

  // 可添加更多记录...
]`;

export const ImportDialog = ({ open, onOpenChange, onSuccess }: ImportDialogProps) => {
  const { t } = useTranslation();
  const [view, setView] = useState<DialogView>("select");
  const [batchFormat, setBatchFormat] = useState<BatchFormat>("csv");
  const [state, setState] = useState<ImportState>("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedProvider, setCopiedProvider] = useState<string | null>(null);

  const handleReset = () => {
    setState("idle");
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    handleReset();
    setView("select");
    onOpenChange(false);
  };

  const handleBack = () => {
    handleReset();
    setView("select");
  };

  const handleSingleImport = async () => {
    setState("importing");
    setError(null);

    try {
      const summary = await ImportAccounts();
      if (summary.cancelled) {
        setState("idle");
        return;
      }
      setResult({
        imported: summary.imported,
        skipped: summary.skipped,
        failed: summary.failed,
      });
      setState("done");
      if (summary.imported > 0) {
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("import.error"));
      setState("done");
    }
  };

  const handleBatchImport = async () => {
    setState("importing");
    setError(null);
    setResult(null);

    try {
      const summary = await ImportAccountsBatch();
      if (summary.cancelled) {
        setState("idle");
        return;
      }
      setResult({
        imported: summary.imported,
        skipped: summary.skipped,
        failed: summary.failed,
        errors: summary.errors,
      });
      setState("done");
      if (summary.imported > 0) {
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("import.error"));
      setState("done");
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await DownloadImportTemplate(batchFormat);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("import.templateDownloadFailed"));
    }
  };

  const handleCopyProvider = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedProvider(id);
    setTimeout(() => setCopiedProvider(null), 1500);
  };

  const renderResultSummary = () => {
    if (!result) return null;

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>{t("import.imported", { count: result.imported })}</span>
          </div>
          {result.skipped > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span>{t("import.skipped", { count: result.skipped })}</span>
            </div>
          )}
          {result.failed > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>{t("import.failed", { count: result.failed })}</span>
            </div>
          )}
        </div>

        {result.errors && result.errors.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-lg border border-border/60 bg-muted/10 p-3">
            <div className="space-y-2 text-sm">
              {result.errors.slice(0, 10).map((err, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Badge variant="outline" className="shrink-0">
                    {err.index > 0 ? `#${err.index}` : t("import.fileError")}
                  </Badge>
                  <span className="text-muted-foreground">
                    {err.name && <span className="font-medium">{err.name}: </span>}
                    {err.message}
                  </span>
                </div>
              ))}
              {result.errors.length > 10 && (
                <div className="text-muted-foreground">
                  {t("import.moreErrors", { count: result.errors.length - 10 })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 选择导入方式视图
  const renderSelectView = () => (
    <div className="space-y-6 py-4">
      <div className="flex gap-4">
        {/* 单文件导入按钮 */}
        <Button
          variant="outline"
          size="lg"
          onClick={handleSingleImport}
          disabled={state === "importing"}
          className="flex h-auto flex-1 flex-col items-center gap-3 py-6"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {state === "importing" ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <FileArchive className="h-6 w-6" />
            )}
          </div>
          <div className="text-center">
            <div className="font-semibold">{t("import.single.title")}</div>
            <div className="mt-1 text-xs font-normal text-muted-foreground">
              {t("import.single.hint")}
            </div>
          </div>
        </Button>

        {/* 批量导入按钮 */}
        <Button
          variant="outline"
          size="lg"
          onClick={() => setView("batch")}
          disabled={state === "importing"}
          className="flex h-auto flex-1 flex-col items-center gap-3 py-6"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div className="text-center">
            <div className="font-semibold">{t("import.batch.title")}</div>
            <div className="mt-1 text-xs font-normal text-muted-foreground">
              {t("import.batch.hint")}
            </div>
          </div>
        </Button>
      </div>

      {/* 单文件导入结果 */}
      {state === "done" && (result || error) && (
        <div className="space-y-3">
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            renderResultSummary()
          )}
        </div>
      )}
    </div>
  );

  // 批量导入视图
  const renderBatchView = () => (
    <div className="space-y-4 py-4">
      {/* 格式选择 Tabs */}
      <Tabs value={batchFormat} onValueChange={(v) => setBatchFormat(v as BatchFormat)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="csv" className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </TabsTrigger>
          <TabsTrigger value="json" className="gap-2">
            <FileJson className="h-4 w-4" />
            JSON
          </TabsTrigger>
        </TabsList>

        <TabsContent value="csv" className="mt-4 space-y-4">
          {/* CSV 模板预览 */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <h4 className="mb-2 text-sm font-medium">{t("import.batch.templatePreview")}</h4>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
              {CSV_EXAMPLE}
            </pre>
          </div>

          {/* 说明事项 */}
          <div className="text-xs text-muted-foreground">
            <p className="font-medium">{t("import.batch.requiredFields")}</p>
            <p className="mt-1">
              <code className="rounded bg-muted px-1">name</code>,{" "}
              <code className="rounded bg-muted px-1">provider</code>,{" "}
              <code className="rounded bg-muted px-1">endpoint</code>,{" "}
              <code className="rounded bg-muted px-1">accessKeyId</code>,{" "}
              <code className="rounded bg-muted px-1">secretAccessKey</code>
            </p>
            <p className="mt-2 font-medium">{t("import.batch.optionalFields")}</p>
            <p className="mt-1">
              <code className="rounded bg-muted px-1">tag</code> ({t("import.batch.defaultEmpty")}),{" "}
              <code className="rounded bg-muted px-1">region</code> (
              {t("import.batch.defaultEmpty")}
              ), <code className="rounded bg-muted px-1">useSSL</code> (
              {t("import.batch.defaultTrue")}), <code className="rounded bg-muted px-1">port</code>
            </p>
            <p className="mt-2 font-medium">{t("import.batch.notes")}</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>{t("import.batch.note.header")}</li>
              <li>{t("import.batch.note.quote")}</li>
              <li>{t("import.batch.note.comment")}</li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="json" className="mt-4 space-y-4">
          {/* JSON 模板预览 */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <h4 className="mb-2 text-sm font-medium">{t("import.batch.templatePreview")}</h4>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
              {JSON_EXAMPLE}
            </pre>
          </div>

          {/* 说明事项 */}
          <div className="text-xs text-muted-foreground">
            <p className="font-medium">{t("import.batch.requiredFields")}</p>
            <p className="mt-1">
              <code className="rounded bg-muted px-1">name</code>,{" "}
              <code className="rounded bg-muted px-1">provider</code>,{" "}
              <code className="rounded bg-muted px-1">endpoint</code>,{" "}
              <code className="rounded bg-muted px-1">accessKeyId</code>,{" "}
              <code className="rounded bg-muted px-1">secretAccessKey</code>
            </p>
            <p className="mt-2 font-medium">{t("import.batch.optionalFields")}</p>
            <p className="mt-1">
              <code className="rounded bg-muted px-1">tag</code> ({t("import.batch.defaultEmpty")}),{" "}
              <code className="rounded bg-muted px-1">region</code> (
              {t("import.batch.defaultEmpty")}
              ), <code className="rounded bg-muted px-1">useSSL</code> (
              {t("import.batch.defaultTrue")}), <code className="rounded bg-muted px-1">port</code>
            </p>
            <p className="mt-2 font-medium">{t("import.batch.notes")}</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>{t("import.batch.note.array")}</li>
              <li>{t("import.batch.note.jsonc")}</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>

      {/* Provider 可选值 - 使用真实图标 */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {t("import.batch.providerLabel")}
        </p>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleCopyProvider(p.id)}
              className="relative flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-xs transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <ProviderIcon provider={p.id} size="sm" className="h-4 w-4" />
              <span className="font-medium">{p.id}</span>
              {/* 复制成功覆盖层 */}
              {copiedProvider === p.id && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-gray-100">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 导入结果 */}
      {state === "done" && (result || error) && (
        <div className="space-y-3">
          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : (
            renderResultSummary()
          )}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <div className="flex items-center">
          {view === "batch" && (
            <Button variant="ghost" size="sm" className="mr-2" onClick={handleBack}>
              <ArrowLeft className="h-2 w-2" />
            </Button>
          )}
          <DialogHeader>
            <DialogTitle>
              {view === "select" ? t("import.title") : t("import.batch.dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {view === "select" ? t("import.description") : t("import.batch.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
        </div>

        {view === "select" ? renderSelectView() : renderBatchView()}

        {view === "batch" && (
          <DialogFooter className="gap-2">
            <Button variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4" />
              {t("import.downloadTemplate")}
            </Button>
            <Button className="gap-2" onClick={handleBatchImport} disabled={state === "importing"}>
              {state === "importing" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {state === "importing" ? t("import.importing") : t("import.startImport")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
