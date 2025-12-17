/**
 * Unified Logger for Frontend
 *
 * Provides structured logging with batch queue, error handling,
 * and backend integration via Wails bindings.
 */

import { GetLogLevel, LogBatch, LogWithContext, SetLogLevel } from "@wailsjs/go/app/App";

// Types
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  context: LogContext;
  timestamp: number;
}

// Batch queue configuration
const logQueue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 100; // ms
const MAX_QUEUE_SIZE = 50;

// Level priority for filtering
let currentLevel: LogLevel = "info";
const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * Check if a log at the given level should be logged based on current level
 */
function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[currentLevel];
}

/**
 * Flush the log queue to the backend
 */
async function flushQueue(): Promise<void> {
  if (logQueue.length === 0) return;

  const entries = logQueue.splice(0, logQueue.length);

  try {
    // Try batch logging first
    if (LogBatch) {
      await LogBatch(entries);
    } else {
      // Fallback: send one by one
      for (const entry of entries) {
        await LogWithContext(entry.level, entry.module, entry.message, entry.context);
      }
    }
  } catch (e) {
    // Silent fail - we can't log logging errors
    if (import.meta.env.DEV) {
      console.error("[logger] Failed to flush logs:", e);
    }
  }
}

/**
 * Enqueue a log entry for batch sending
 */
function enqueue(entry: LogEntry): void {
  logQueue.push(entry);

  // Flush immediately if queue is full
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue();
    return;
  }

  // Otherwise, debounce flush
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushQueue();
    }, FLUSH_INTERVAL);
  }
}

/**
 * Sanitize context to handle Error objects and large payloads
 */
function sanitizeContext(context?: LogContext): LogContext {
  if (!context) return {};

  const sanitized: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (value instanceof Error) {
      // Extract error details
      sanitized[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack?.split("\n").slice(0, 5).join("\n"), // Limit stack depth
      };
    } else if (typeof value === "object" && value !== null) {
      // Limit object size to prevent large payloads
      try {
        const json = JSON.stringify(value);
        sanitized[key] = json.length > 1024 ? "[Object too large]" : value;
      } catch {
        sanitized[key] = "[Unserializable]";
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Internal log function
 */
function log(level: LogLevel, module: string, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const sanitizedContext = sanitizeContext(context);

  // Dev mode: also output to console for debugging
  if (import.meta.env.DEV) {
    const consoleMethod = level === "fatal" ? "error" : level;
    // eslint-disable-next-line no-console
    console[consoleMethod](`[${module}] ${message}`, sanitizedContext);
  }

  enqueue({
    level,
    module,
    message,
    context: sanitizedContext,
    timestamp: Date.now(),
  });
}

/**
 * Logger API
 */
export const logger = {
  /**
   * Log a debug message
   */
  debug(module: string, message: string, context?: LogContext): void {
    log("debug", module, message, context);
  },

  /**
   * Log an info message
   */
  info(module: string, message: string, context?: LogContext): void {
    log("info", module, message, context);
  },

  /**
   * Log a warning message
   */
  warn(module: string, message: string, context?: LogContext): void {
    log("warn", module, message, context);
  },

  /**
   * Log an error message
   */
  error(module: string, message: string, context?: LogContext): void {
    log("error", module, message, context);
  },

  /**
   * Log a fatal message (flushes immediately)
   */
  fatal(module: string, message: string, context?: LogContext): void {
    log("fatal", module, message, context);
    // Fatal: flush immediately
    flushQueue();
  },

  /**
   * Set the log level at runtime
   */
  async setLevel(level: LogLevel): Promise<void> {
    currentLevel = level;
    try {
      await SetLogLevel(level);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("[logger] Failed to set log level:", e);
      }
    }
  },

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return currentLevel;
  },

  /**
   * Initialize the logger level from backend
   */
  async init(): Promise<void> {
    try {
      const level = await GetLogLevel();
      if (level) {
        currentLevel = level as LogLevel;
      }
    } catch {
      // Silent fail - backend may not be ready
    }
  },

  /**
   * Generate a trace ID for correlating related operations
   */
  startTrace(): string {
    return crypto.randomUUID().slice(0, 8);
  },

  /**
   * Force flush (useful before app exit or crash)
   */
  flush(): void {
    flushQueue();
  },
};

// Export for convenience
export default logger;
