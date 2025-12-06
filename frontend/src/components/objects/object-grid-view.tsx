import { type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
} from "lucide-react";

export type ObjectGridItem = {
  key: string;
  size?: number;
  lastModified?: string;
  isDir: boolean;
};

type ObjectGridViewProps = {
  objects: ObjectGridItem[];
  prefix: string;
  onEnterDir: (key: string) => void;
  onFileClick?: (key: string) => void;
  selectedKeys?: Set<string>;
  onToggleSelect?: (key: string) => void;
  wrapItem?: (object: ObjectGridItem, node: ReactNode) => ReactNode;
  className?: string;
};

const getFileIcon = (key: string) => {
  const ext = key.split(".").pop()?.toLowerCase() || "";

  // Images
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return <FileImage className="h-8 w-8 text-pink-500" />;
  }
  // Videos
  if (["mp4", "webm", "avi", "mov", "mkv", "flv"].includes(ext)) {
    return <FileVideo className="h-8 w-8 text-purple-500" />;
  }
  // Audio
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) {
    return <FileAudio className="h-8 w-8 text-green-500" />;
  }
  // Archives
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) {
    return <FileArchive className="h-8 w-8 text-amber-500" />;
  }
  // Documents
  if (["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext)) {
    return <FileText className="h-8 w-8 text-blue-500" />;
  }
  // Spreadsheets
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) {
    return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
  }
  // Code
  if (
    [
      "js",
      "ts",
      "jsx",
      "tsx",
      "py",
      "go",
      "rs",
      "java",
      "c",
      "cpp",
      "h",
      "json",
      "xml",
      "html",
      "css",
      "yaml",
      "yml",
      "md",
    ].includes(ext)
  ) {
    return <FileCode className="h-8 w-8 text-cyan-500" />;
  }

  return <File className="h-8 w-8 text-muted-foreground" />;
};

const deriveLabel = (key: string, prefix: string, isDir: boolean) => {
  const base = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
  if (isDir) {
    return base.replace(/\/$/, "");
  }
  const parts = base.split("/").filter(Boolean);
  return parts.join("/");
};

const formatSize = (size?: number) => {
  if (!size) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

export function ObjectGridView({
  objects,
  prefix,
  onEnterDir,
  onFileClick,
  selectedKeys,
  onToggleSelect,
  wrapItem,
  className,
}: ObjectGridViewProps) {
  if (objects.length === 0) {
    return <p className="text-sm text-muted-foreground">当前路径下暂无对象。</p>;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6",
        className,
      )}
    >
      {objects.map((object) => {
        const label = deriveLabel(object.key, prefix, object.isDir);
        const sizeText = !object.isDir ? formatSize(object.size) : "";
        const isSelected = selectedKeys?.has(object.key) ?? false;

        const card = (
          <button
            type="button"
            onClick={() => {
              if (object.isDir) {
                onEnterDir(object.key.endsWith("/") ? object.key : `${object.key}/`);
              } else {
                onFileClick?.(object.key);
              }
            }}
            className={cn(
              "group relative flex flex-col items-center gap-2 rounded-xl border border-border/40 bg-card/50 p-4 text-center transition-all",
              "hover:border-primary/50 hover:bg-accent/50 hover:shadow-md",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected && "border-primary/60 bg-primary/5",
            )}
          >
            {!object.isDir && onToggleSelect ? (
              <div className="absolute left-3 top-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => {
                    onToggleSelect(object.key);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            ) : null}
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted/50 transition-transform group-hover:scale-110">
              {object.isDir ? <Folder className="h-8 w-8 text-primary" /> : getFileIcon(object.key)}
            </div>
            <div className="w-full min-w-0">
              <p className="truncate text-sm font-medium" title={label}>
                {label}
              </p>
              {sizeText ? (
                <p className="truncate text-xs text-muted-foreground">{sizeText}</p>
              ) : null}
            </div>
          </button>
        );

        const content = wrapItem ? wrapItem(object, card) : card;
        return (
          <div key={object.key} className="contents">
            {content}
          </div>
        );
      })}
    </div>
  );
}
