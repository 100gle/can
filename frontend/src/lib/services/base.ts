/**
 * Base Service Class
 *
 * Provides common functionality for all service classes including:
 * - Bridge availability checking
 * - Unified error handling
 * - Toast notification integration
 */

import { logger } from "@/lib/logger";
import { showError, showLoading, showSuccess } from "@/lib/toast";
import { toast } from "sonner";
import { ServiceError, ServiceErrorCode, type ServiceResult, type ToastConfig } from "./types";

/**
 * Base service class with common utilities
 */
export abstract class BaseService {
  /**
   * Execute an API call with automatic toast feedback
   */
  protected async callWithToast<T>(
    apiCall: () => Promise<T>,
    config: ToastConfig = {},
  ): Promise<ServiceResult<T>> {
    // Show loading toast if configured
    let loadingToast: string | number | undefined;
    if (config.loading) {
      loadingToast = showLoading(config.loading);
    }

    try {
      const data = await apiCall();

      // Dismiss loading toast
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }

      // Show success toast if configured
      if (config.success) {
        showSuccess(config.success);
      }

      return { success: true, data };
    } catch (error) {
      // Dismiss loading toast
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }

      // Extract error message
      const errorMessage = this.extractErrorMessage(error);

      // Show error toast if configured
      if (config.error !== false) {
        const displayError = config.error || errorMessage;
        showError(displayError);
      }

      logger.error("service.callWithToast", "API call failed", {
        error: errorMessage,
        rawError: error,
      });

      return {
        success: false,
        error: errorMessage,
        code: ServiceErrorCode.API_ERROR,
      };
    }
  }

  /**
   * Execute an API call without toast feedback (for silent operations)
   */
  protected async callSilent<T>(apiCall: () => Promise<T>): Promise<ServiceResult<T>> {
    try {
      const data = await apiCall();
      return { success: true, data };
    } catch (error) {
      logger.error("service.callSilent", "Silent API call failed", {
        error: this.extractErrorMessage(error),
        rawError: error,
      });
      return {
        success: false,
        error: this.extractErrorMessage(error),
        code: ServiceErrorCode.API_ERROR,
      };
    }
  }

  /**
   * Extract error message from unknown error type
   */
  protected extractErrorMessage(error: unknown): string {
    if (error instanceof ServiceError) {
      return error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "未知错误";
  }

  /**
   * Validate required parameters
   */
  protected validateRequired(params: Record<string, unknown>): void {
    const missing = Object.entries(params)
      .filter(([_, value]) => value === undefined || value === null || value === "")
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new ServiceError(
        `缺少必需参数: ${missing.join(", ")}`,
        ServiceErrorCode.VALIDATION_ERROR,
      );
    }
  }
}
