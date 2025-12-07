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

type ExportFormat = "csv" | "json" | "txt";

type ExportField = {
  key: keyof ObjectModel | "fullPath";
  label: string;
  defaultChecked: boolean;
};

const EXPORT_FIELDS: ExportField[] = [
  { key: "fullPath", label: "完整路径", defaultChecked: true },
  { key: "key", label: "对象 Key", defaultChecked: true },
  { key: "size", label: "文件大小", defaultChecked: true },
  { key: "lastModified", label: "修改时间", defaultChecked: true },
  { key: "storageClass", label: "存储类型", defaultChecked: false },
  { key: "etag", label: "ETag", defaultChecked: false },
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
        if (field.key === "fullPath") {
          row[field.label] = `s3://${bucket}/${file.key}`;
        } else if (field.key === "lastModified") {
          row[field.label] = file.lastModified ? new Date(file.lastModified).toISOString() : "";
        } else {
          row[field.label] = file[field.key as keyof ObjectModel] as string | number | undefined;
        }
      }
      return row;
    });
  }, [objects, selectedFields, bucket]);

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
            导出文件列表
          </DialogTitle>
          <DialogDescription>将选中的 {fileCount} 个文件信息导出为指定格式。</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>导出格式</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    {formatIcons.csv}
                    CSV (逗号分隔)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    {formatIcons.json}
                    JSON
                  </div>
                </SelectItem>
                <SelectItem value="txt">
                  <div className="flex items-center gap-2">
                    {formatIcons.txt}
                    TXT (制表符分隔)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>包含字段</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border/40 p-3">
              {EXPORT_FIELDS.map((field) => (
                <label key={field.key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={selectedFields.has(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            取消
          </Button>
          <Button onClick={handleExport} disabled={!canExport || exporting}>
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                导出中...
              </>
            ) : (
              <>
                {formatIcons[format]}
                <span className="ml-2">导出 {fileCount} 项</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
