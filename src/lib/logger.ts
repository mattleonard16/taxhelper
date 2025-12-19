export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
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

