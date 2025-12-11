import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ObjectModel } from "@/state/objects";
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type ExportFormat = "csv" | "json" | "txt";

type ExportField = {
  key: keyof ObjectModel | "fullPath";
  labelKey: string;
  defaultChecked: boolean;
};

const EXPORT_FIELDS: ExportField[] = [
  { key: "fullPath", labelKey: "objects.export.field.fullPath", defaultChecked: true },
  { key: "key", labelKey: "objects.export.field.key", defaultChecked: true },
  { key: "size", labelKey: "objects.export.field.size", defaultChecked: true },
  { key: "lastModified", labelKey: "objects.export.field.lastModified", defaultChecked: true },
  { key: "storageClass", labelKey: "objects.export.field.storageClass", defaultChecked: false },
  { key: "etag", labelKey: "objects.export.field.etag", defaultChecked: false },
];

type ExportFileListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objects: ObjectModel[];
  bucket?: string;
  prefix?: string;
};

export function ExportFileListDialog({
  open,
  onOpenChange,
  objects,
  bucket,
  prefix,
}: ExportFileListDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    () => new Set(EXPORT_FIELDS.filter((f) => f.defaultChecked).map((f) => f.key)),
  );
  const [exporting, setExporting] = useState(false);

  const fileCount = objects.filter((o) => !o.isDir).length;

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const canExport = selectedFields.size > 0 && fileCount > 0;

  const generateExportData = useMemo(() => {
    const files = objects.filter((o) => !o.isDir);
    const fields = EXPORT_FIELDS.filter((f) => selectedFields.has(f.key));

    return files.map((file) => {
      const row: Record<string, string | number | undefined> = {};
      for (const field of fields) {
        // We use translated label as key in the exported file?
        // Usually CSV headers should be readable. Let's use translated label.
        const header = t(field.labelKey);

        if (field.key === "fullPath") {
          row[header] = `s3://${bucket}/${file.key}`;
        } else if (field.key === "lastModified") {
          row[header] = file.lastModified ? new Date(file.lastModified).toISOString() : "";
        } else {
          row[header] = file[field.key as keyof ObjectModel] as string | number | undefined;
        }
      }
      return row;
    });
  }, [objects, selectedFields, bucket, t]);

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);

    try {
      const data = generateExportData;
      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === "json") {
        content = JSON.stringify(data, null, 2);
        mimeType = "application/json";
        extension = "json";
      } else if (format === "csv") {
        const headers = Object.keys(data[0] || {});
        const csvRows = [
          headers.join(","),
          ...data.map((row) =>
            headers
              .map((h) => {
                const val = row[h];
                if (val === undefined || val === null) return "";
                const str = String(val);
                // Escape quotes and wrap in quotes if contains comma or quote
                if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                  return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
              })
              .join(","),
          ),
        ];
        content = csvRows.join("\n");
        mimeType = "text/csv";
        extension = "csv";
      } else {
        // txt format - simple list of paths
        content = data.map((row) => Object.values(row).join("\t")).join("\n");
        mimeType = "text/plain";
        extension = "txt";
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${bucket || "objects"}-${prefix?.replace(/\//g, "-") || "root"}-export.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onOpenChange(false);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  const formatIcons = {
    csv: <FileSpreadsheet className="h-4 w-4" />,
    json: <FileJson className="h-4 w-4" />,
    txt: <FileText className="h-4 w-4" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t("objects.export.title")}
          </DialogTitle>
          <DialogDescription>
            {t("objects.export.description", { count: fileCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("objects.export.format.label")}</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    {formatIcons.csv}
                    {t("objects.export.format.csv")}
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    {formatIcons.json}
                    {t("objects.export.format.json")}
                  </div>
                </SelectItem>
                <SelectItem value="txt">
                  <div className="flex items-center gap-2">
                    {formatIcons.txt}
                    {t("objects.export.format.txt")}
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("objects.export.fields.label")}</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/40 p-3">
              {EXPORT_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedFields.has(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  {t(field.labelKey)}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            {t("objects.export.button.cancel")}
          </Button>
          <Button onClick={handleExport} disabled={!canExport || exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("objects.export.button.exporting")}
              </>
            ) : (
              <>
                {formatIcons[format]}
                <span className="ml-2">
                  {t("objects.export.button.export", { count: fileCount })}
                </span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
