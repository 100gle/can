/**
 * Service Layer Type Definitions
 * 
 * Provides unified types for service responses, error handling, and toast notifications.
 */

/**
 * Unified service response type
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

/**
 * Toast notification configuration
 */
export interface ToastConfig {
  /** Message to show while loading */
  loading?: string;
  /** Message to show on success */
  success?: string;
  /** Message to show on error, or false to disable error toast */
  error?: string | false;
}

/**
 * Service error codes
 */
export enum ServiceErrorCode {
  BRIDGE_UNAVAILABLE = "BRIDGE_UNAVAILABLE",
  API_ERROR = "API_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Base service error class
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: ServiceErrorCode = ServiceErrorCode.UNKNOWN_ERROR,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
