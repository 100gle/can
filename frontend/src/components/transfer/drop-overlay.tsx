/**
 * DropOverlay
 *
 * Fullscreen overlay for native file drops from OS.
 * Uses Wails OnFileDrop API to capture files and upload via backend queue.
 */

/**
 * DropOverlay
 *
 * Fullscreen overlay for native file drops from OS.
 * Uses Wails OnFileDrop API to capture files and upload via backend queue.
 */

import { useFileDrop } from "@/hooks/useFileDrop";
import { useObjectsStore } from "@/state/objects";
import { transfersStore } from "@/state/transfers";
import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import "./drop-overlay.css";

/**
 * Compute the common base path for a list of file paths.
 * Used to preserve directory structure when uploading multiple files.
 */
function computeCommonBasePath(paths: string[]): string {
  if (paths.length === 0) return "";
  if (paths.length === 1) {
    // Single file: use parent directory
    const lastSlash = paths[0].lastIndexOf("/");
    const lastBackslash = paths[0].lastIndexOf("\\");
    const idx = Math.max(lastSlash, lastBackslash);
    return idx > 0 ? paths[0].substring(0, idx) : "";
  }

  // Find common prefix of all paths
  const separator = paths[0].includes("\\") ? "\\" : "/";
  const splitPaths = paths.map((p) => p.split(/[/\\]/));
  const minLength = Math.min(...splitPaths.map((p) => p.length));

  let commonParts: string[] = [];
  for (let i = 0; i < minLength - 1; i++) {
    const part = splitPaths[0][i];
    if (splitPaths.every((sp) => sp[i] === part)) {
      commonParts.push(part);
    } else {
      break;
    }
  }

  return commonParts.join(separator);
}

/**
 * DropOverlay component
 *
 * Renders a fullscreen overlay when files are dragged over the window.
 * Automatically uploads dropped files to the current bucket/prefix.
 */
export function DropOverlay() {
  const { t } = useTranslation();
  const { droppedPaths, clearDroppedPaths, isActive } = useFileDrop();
  const { accountId } = useParams({ strict: false });

  // Get current bucket and prefix from objects store
  const bucket = useObjectsStore((s) => s.bucket);
  const prefix = useObjectsStore((s) => s.prefix);

  // Compute base path for directory structure preservation
  const basePath = useMemo(() => computeCommonBasePath(droppedPaths), [droppedPaths]);

  // Handle file drops
  useEffect(() => {
    if (droppedPaths.length === 0) return;

    // Need account and bucket context
    if (!accountId || !bucket) {
      toast.error(t("dropOverlay.error.noContext"));
      clearDroppedPaths();
      return;
    }

    // Upload via backend queue
    transfersStore.uploadFilesFromPaths(droppedPaths, {
      accountId,
      bucket,
      prefix,
      basePath,
    });
    transfersStore.syncBackendTasks();

    toast.success(t("dropOverlay.success.queued", { count: droppedPaths.length }));
    clearDroppedPaths();
  }, [droppedPaths, accountId, bucket, prefix, basePath, clearDroppedPaths, t]); // Added t to deps

  // Only show overlay when files are being dragged
  if (!isActive) {
    return null;
  }

  return (
    <div className="drop-overlay">
      <div className="drop-overlay-content">
        <div className="drop-overlay-icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h2 className="drop-overlay-title">{t("dropOverlay.title")}</h2>
        <p className="drop-overlay-subtitle">{t("dropOverlay.subtitle")}</p>
      </div>
    </div>
  );
}
