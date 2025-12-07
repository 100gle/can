/**
 * File System Access API utilities for browser directory/file picking
 * Note: Currently only supported in Chrome/Edge browsers
 */

/**
 * Pick a directory using File System Access API (Chrome/Edge only)
 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  // Check if File System Access API is available (Chrome/Edge only)
  if ("showDirectoryPicker" in window) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });
      return dirHandle;
    } catch (error) {
      // User cancelled or error occurred
      console.log("Directory picker cancelled or failed:", error);
      return null;
    }
  }

  // Fallback: not supported in this browser
  return null;
}

/**
 * Get directory path from handle (for display purposes)
 * Note: File System Access API doesn't provide real paths for security reasons
 */
export async function getDirectoryPath(handle: FileSystemDirectoryHandle): Promise<string> {
  // The API doesn't expose real filesystem paths for security
  // We can only get the directory name
  return handle.name;
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return "showDirectoryPicker" in window;
}
