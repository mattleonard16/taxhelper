export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
}

export interface OperationLogContext extends LogContext {
  event: string;
  jobId?: string;
  durationMs?: number;
  count?: number;
  errorCode?: string;
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    const includeStack = process.env.NODE_ENV !== "production";
    return {
      name: error.name,
      message: error.message,
      ...(includeStack ? { stack: error.stack } : {}),
    };
  }
  return error;
}

export function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { ...context, error: serializeError(context.error) } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string, context?: LogContext) => log("info", message, context),
  warn: (message: string, context?: LogContext) => log("warn", message, context),
  error: (message: string, context?: LogContext) => log("error", message, context),
};

/**
 * Structured operation logger for key workflows.
 * Logs event name, userId, duration, counts, and error codes.
 * Never logs sensitive content like OCR text or receipt data.
 */
export const operationLogger = {
  /**
   * Log a receipt pipeline event
   */
  receiptPipeline: (
    event: "status_transition" | "confirm" | "retry" | "discard" | "recover_stuck",
    context: {
      userId?: string;
      jobId?: string;
      fromStatus?: string;
      toStatus?: string;
      transactionId?: string;
      count?: number;
      errorCode?: string;
      durationMs?: number;
    }
  ) => {
    log("info", `receipt.${event}`, {
      event: `receipt.${event}`,
      ...context,
    });
  },

  /**
   * Log a batch operation
   */
  batchOperation: (
    operation: "update" | "delete",
    context: {
      requestId?: string;
      userId?: string;
      count: number;
      durationMs: number;
      errorCode?: string;
    }
  ) => {
    const level = context.errorCode ? "error" : "info";
    log(level, `batch.${operation}`, {
      event: `batch.${operation}`,
      ...context,
    });
  },

  /**
   * Log a transaction search
   */
  transactionSearch: (context: {
    requestId?: string;
    userId?: string;
    filters: {
      hasDateRange?: boolean;
      hasType?: boolean;
      hasSearch?: boolean;
      hasAmountRange?: boolean;
      hasCategory?: boolean;
      hasDeductible?: boolean;
    };
    resultCount: number;
    durationMs: number;
  }) => {
    log("info", "transaction.search", {
      event: "transaction.search",
      ...context,
    });
  },
};

/**
 * Timer utility for measuring operation duration
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

