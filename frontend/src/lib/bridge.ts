/**
 * Check if Wails runtime API is available (desktop mode)
 * This is the recommended way to detect if we're running in Wails desktop app
 */
export function isDesktopMode(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any)?.runtime);
}

/**
 * @deprecated Use isDesktopMode() instead
 * Kept for backward compatibility
 */
export function isBridgeAvailable(): boolean {
  return isDesktopMode();
}

const getRuntime = (): Record<string, any> | undefined => {
  if (typeof window === "undefined") return undefined;
  return (window as any)?.runtime;
};

export type FileDialogOptions = {
  Title?: string;
  DefaultFilename?: string;
  Filters?: { DisplayName: string; Pattern: string }[];
  CanCreateDirectories?: boolean;
  ShowHiddenFiles?: boolean;
  InitialDirectory?: string;
};

export async function openFileDialog(options?: FileDialogOptions): Promise<string | undefined> {
  const runtime = getRuntime();
  if (!runtime?.OpenFileDialog) return undefined;
  const result = await runtime.OpenFileDialog(options ?? {});
  if (!result) return undefined;
  return String(result);
}

export async function saveFileDialog(options?: FileDialogOptions): Promise<string | undefined> {
  console.log("[saveFileDialog] Called with options:", options);

  // Check if bridge is available (desktop mode)
  if (!isBridgeAvailable()) {
    console.log("[saveFileDialog] Bridge not available, not in desktop mode");
    // Web mode: File System Access API not suitable for save operations
    // User would need to download the file normally
    return undefined;
  }

  // Use the backend SaveFileDialog method
  try {
    const { SaveFileDialog } = await import("@wailsjs/go/app/App");

    const title = options?.Title || "Save File";
    const defaultFilename = options?.DefaultFilename || "";
    const filters =
      options?.Filters?.map((f) => ({
        displayName: f.DisplayName,
        pattern: f.Pattern,
      })) || [];

    console.log("[saveFileDialog] Calling backend SaveFileDialog");
    const result = await SaveFileDialog(title, defaultFilename, filters);
    console.log("[saveFileDialog] Backend returned:", result);

    // Empty string means user cancelled
    if (!result || result === "") {
      console.log("[saveFileDialog] User cancelled or empty result");
      return undefined;
    }

    return result;
  } catch (error) {
    console.error("[saveFileDialog] Error calling backend:", error);
    return undefined;
  }
}

/**
 * Open directory picker dialog
 * In desktop mode, uses backend SelectLocalFolder
 * In web mode (Chrome/Edge only), uses File System Access API
 */
export async function openDirectoryDialog(title?: string): Promise<string | undefined> {
  // Try desktop mode first
  if (isBridgeAvailable()) {
    try {
      const { SelectLocalFolder } = await import("@wailsjs/go/app/App");
      const result = await SelectLocalFolder(title || "Select Directory");
      return result || undefined;
    } catch (error) {
      console.error("[openDirectoryDialog] Backend call failed:", error);
      return undefined;
    }
  }

  // Web mode: try File System Access API (Chrome/Edge only)
  if ("showDirectoryPicker" in window) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });
      // File System Access API doesn't give us the real path
      // We return the directory name as a pseudo-path
      return dirHandle.name;
    } catch (error) {
      // User cancelled or API not available
      console.log("[openDirectoryDialog] Directory picker cancelled or failed:", error);
      return undefined;
    }
  }

  // Not supported
  console.warn("[openDirectoryDialog] Neither desktop mode nor File System Access API available");
  return undefined;
}
