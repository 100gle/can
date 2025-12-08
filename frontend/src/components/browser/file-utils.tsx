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
} from "lucide-react";

/**
 * Derive display label from object key
 */
export const deriveLabel = (key: string, prefix: string): string => {
  const base = prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key;
  return base.replace(/\/$/, "");
};

/**
 * Format file size to human readable string
 */
export const formatSize = (size?: number): string => {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

/**
 * Get file icon based on extension
 */
/**
 * Format date to locale string
 */
export const formatDate = (value: any) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return "-";
  }
};

/**
 * Get file icon based on extension
 */
export const getFileIcon = (key: string, sizeClass: string) => {
  const ext = key.split(".").pop()?.toLowerCase() || "";

  // Images
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)) {
    return <FileImage className={cn(sizeClass, "text-pink-500")} />;
  }
  // Videos
  if (["mp4", "webm", "avi", "mov", "mkv", "flv"].includes(ext)) {
    return <FileVideo className={cn(sizeClass, "text-purple-500")} />;
  }
  // Audio
  if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) {
    return <FileAudio className={cn(sizeClass, "text-green-500")} />;
  }
  // Archives
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(ext)) {
    return <FileArchive className={cn(sizeClass, "text-amber-500")} />;
  }
  // Documents
  if (["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext)) {
    return <FileText className={cn(sizeClass, "text-blue-500")} />;
  }
  // Spreadsheets
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) {
    return <FileSpreadsheet className={cn(sizeClass, "text-emerald-500")} />;
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
    return <FileCode className={cn(sizeClass, "text-cyan-500")} />;
  }

  return <File className={cn(sizeClass, "text-muted-foreground")} />;
};
