import { useCallback } from "react";

/**
 * Provides a back navigation handler that falls back to a custom callback when
 * the browser history stack cannot go backwards (e.g. deep-link entry).
 */
export const useBackNavigation = (fallback?: () => void) => {
  return useCallback(() => {
    const canUseHistory =
      typeof window !== "undefined" &&
      typeof window.history !== "undefined" &&
      window.history.length > 1;

    if (canUseHistory) {
      window.history.back();
      return;
    }

    fallback?.();
  }, [fallback]);
};
