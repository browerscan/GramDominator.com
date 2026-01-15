/**
 * Structured Logger
 * Production-ready logging with levels and error handling
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.ERROR]: "ERROR",
  [LogLevel.WARN]: "WARN",
  [LogLevel.INFO]: "INFO",
  [LogLevel.DEBUG]: "DEBUG",
};

/**
 * Get minimum log level from environment
 * Defaults to INFO in production, DEBUG in development
 */
function getMinLogLevel(): LogLevel {
  if (typeof process === "undefined" || typeof process.env === "undefined") {
    return LogLevel.INFO;
  }

  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  if (envLevel === "ERROR") return LogLevel.ERROR;
  if (envLevel === "WARN") return LogLevel.WARN;
  if (envLevel === "DEBUG") return LogLevel.DEBUG;

  // Default to INFO in production, DEBUG in development
  return process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG;
}

const minLogLevel = getMinLogLevel();

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return level <= minLogLevel;
}

/**
 * Format log entry with timestamp and level
 */
function formatLogEntry(level: LogLevel, messages: unknown[]): string[] {
  const timestamp = new Date().toISOString();
  const levelName = LOG_LEVEL_NAMES[level] ?? "INFO";
  return [`[${timestamp}] [${levelName}]`, ...(messages as string[])];
}

/**
 * Send error to external monitoring service (Sentry, etc.)
 */
function reportToMonitoring(
  level: LogLevel,
  messages: unknown[],
  error?: Error,
): void {
  // TODO: Integrate with Sentry or similar service
  // This is a placeholder for future integration
  if (level === LogLevel.ERROR && typeof window !== "undefined") {
    // In browser, queue for error reporting
    if (error && "reportError" in window) {
      try {
        (window as unknown as { reportError: (e: Error) => void }).reportError(
          error,
        );
      } catch {
        // Silently fail if reporting not available
      }
    }
  }
}

export const logger = {
  /**
   * Log error messages - always logged
   */
  error(...messages: unknown[]): void {
    if (shouldLog(LogLevel.ERROR)) {
      const formatted = formatLogEntry(LogLevel.ERROR, messages);
      console.error(...formatted);
    }
    reportToMonitoring(LogLevel.ERROR, messages);
  },

  /**
   * Log warning messages
   */
  warn(...messages: unknown[]): void {
    if (shouldLog(LogLevel.WARN)) {
      const formatted = formatLogEntry(LogLevel.WARN, messages);
      console.warn(...formatted);
    }
  },

  /**
   * Log info messages
   */
  info(...messages: unknown[]): void {
    if (shouldLog(LogLevel.INFO)) {
      const formatted = formatLogEntry(LogLevel.INFO, messages);
      console.info(...formatted);
    }
  },

  /**
   * Log debug messages - only in non-production
   */
  debug(...messages: unknown[]): void {
    if (shouldLog(LogLevel.DEBUG)) {
      const formatted = formatLogEntry(LogLevel.DEBUG, messages);
      console.log(...formatted);
    }
  },

  /**
   * Log error with exception object
   */
  exception(error: Error, context?: Record<string, unknown>): void {
    if (shouldLog(LogLevel.ERROR)) {
      const contextStr = context ? " " + JSON.stringify(context) : "";
      const formatted = formatLogEntry(LogLevel.ERROR, [
        error.message,
        contextStr,
      ]);
      console.error(...formatted);
      if (error.stack) {
        console.error(error.stack);
      }
    }
    reportToMonitoring(LogLevel.ERROR, [error.message], error);
  },
};

/**
 * Create a scoped logger for a specific module
 */
export function createScopedLogger(scope: string) {
  return {
    error: (...messages: unknown[]) => logger.error(`[${scope}]`, ...messages),
    warn: (...messages: unknown[]) => logger.warn(`[${scope}]`, ...messages),
    info: (...messages: unknown[]) => logger.info(`[${scope}]`, ...messages),
    debug: (...messages: unknown[]) => logger.debug(`[${scope}]`, ...messages),
    exception: (error: Error, context?: Record<string, unknown>) =>
      logger.exception(error, { ...context, scope }),
  };
}
