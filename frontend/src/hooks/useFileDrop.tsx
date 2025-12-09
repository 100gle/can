import { isDesktopMode } from "@/lib/bridge";
import { OnFileDrop, OnFileDropOff } from "@wailsjs/runtime/runtime";
import { useCallback, useEffect, useRef, useState } from "react";

export interface FileDropState {
  /** True when files are dropped (briefly) */
  isActive: boolean;
  /** Array of dropped file paths from the OS */
  droppedPaths: string[];
  /** Clear the dropped paths after handling */
  clearDroppedPaths: () => void;
}

/**
 * Hook to handle native file drops from OS into the Wails window.
 * Uses Wails runtime OnFileDrop API.
 */
export function useFileDrop(): FileDropState {
  const [droppedPaths, setDroppedPaths] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFileDrop = useCallback((_x: number, _y: number, paths: string[]) => {
    setDroppedPaths(paths);
    setIsActive(true);

    // Auto-deactivate after brief period (for UI feedback)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsActive(false);
    }, 300);
  }, []);

  const clearDroppedPaths = useCallback(() => {
    setDroppedPaths([]);
    setIsActive(false);
  }, []);

  useEffect(() => {
    // Only register if Wails bridge is available
    if (!isDesktopMode()) {
      return;
    }

    // Register the file drop listener with Wails runtime
    // The second parameter `true` enables drop target mode
    OnFileDrop(handleFileDrop, true);

    return () => {
      // Cleanup: remove the file drop listener
      OnFileDropOff();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleFileDrop]);

  return {
    isActive,
    droppedPaths,
    clearDroppedPaths,
  };
}
