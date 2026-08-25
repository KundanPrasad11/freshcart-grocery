type LogContext = Record<string, unknown>;

export function logError(event: string, error: unknown, context: LogContext = {}) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(JSON.stringify({ level: "error", event, message, ...context }));
}

export function logInfo(event: string, context: LogContext = {}) {
  console.info(JSON.stringify({ level: "info", event, ...context }));
}
