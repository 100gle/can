/**
 * Unified Toast Helper Functions
 *
 * Provides consistent toast notifications across the application using sonner.
 */

import { toast } from "sonner";

/**
 * Hook to access toast functions
 */
export function useToast() {
  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast.info(message),
    warning: (message: string) => toast.warning(message),
    loading: (message: string) => toast.loading(message),
  };
}

/**
 * Convenience functions for direct toast calls
 */
export const showSuccess = (message: string) => toast.success(message);
export const showError = (message: string) => toast.error(message);
export const showInfo = (message: string) => toast.info(message);
export const showWarning = (message: string) => toast.warning(message);
export const showLoading = (message: string) => toast.loading(message);

/**
 * Promise-based toast with loading state
 */
export const showPromise = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  },
) => {
  return toast.promise(promise, messages);
};
