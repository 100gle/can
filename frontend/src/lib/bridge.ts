/**
 * Wails Desktop Bridge
 * This module provides utilities for interacting with the Wails runtime.
 * Desktop-only - no browser fallbacks.
 */

import { SaveFileDialog, SelectLocalFolder } from "@wailsjs/go/app/App";

/**
 * Get Wails runtime API (desktop only)
 * Returns undefined if not in desktop mode
 */
export function getRuntime(): Record<string, any> | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as any)?.runtime;
}

/**
 * Check if running in Wails desktop app
 */
export function isDesktopMode(): boolean {
  return getRuntime() !== undefined;
}

export type FileDialogOptions = {
  Title?: string;
  DefaultFilename?: string;
  Filters?: { DisplayName: string; Pattern: string }[];
  CanCreateDirectories?: boolean;
  ShowHiddenFiles?: boolean;
  InitialDirectory?: string;
};

/**
 * Open file picker dialog (desktop only)
 */
export async function openFileDialog(options?: FileDialogOptions): Promise<string | undefined> {
  const runtime = getRuntime();
  if (!runtime?.OpenFileDialog) return undefined;
  const result = await runtime.OpenFileDialog(options ?? {});
  if (!result) return undefined;
  return String(result);
}

/**
 * Open save file dialog (desktop only)
 */
export async function saveFileDialog(options?: FileDialogOptions): Promise<string | undefined> {
  if (!isDesktopMode()) {
    console.warn("[saveFileDialog] Not in desktop mode");
    return undefined;
  }

  try {
    const title = options?.Title || "Save File";
    const defaultFilename = options?.DefaultFilename || "";
    const filters =
      options?.Filters?.map((f) => ({
        displayName: f.DisplayName,
        pattern: f.Pattern,
      })) || [];

    const result = await SaveFileDialog(title, defaultFilename, filters);
    if (!result || result === "") {
      return undefined;
    }
    return result;
  } catch (error) {
    console.error("[saveFileDialog] Error:", error);
    return undefined;
  }
}

/**
 * Open directory picker dialog (desktop only)
 */
export async function openDirectoryDialog(title?: string): Promise<string | undefined> {
  if (!isDesktopMode()) {
    console.warn("[openDirectoryDialog] Not in desktop mode");
    return undefined;
  }

  try {
    const result = await SelectLocalFolder(title || "Select Directory");
    return result || undefined;
  } catch (error) {
    console.error("[openDirectoryDialog] Error:", error);
    return undefined;
  }
}
