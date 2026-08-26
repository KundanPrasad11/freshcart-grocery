import { createHash, randomUUID } from "node:crypto";

type LogContext = Record<string, unknown>;

const sensitiveKey =
  /(?:authorization|cookie|password|secret|token|api[_-]?key|email|address|card|payment|body)/i;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\b(?:bearer|basic)\s+[A-Z0-9._~+\/=:-]+/gi;

export type RequestContext = {
  requestId: string;
  route: string;
  method: string;
  startedAt: number;
};

export function createRequestContext(request: Request): RequestContext {
  const candidate = request.headers.get("x-request-id")?.trim();
  const requestId =
    candidate && /^[A-Za-z0-9_-]{8,100}$/.test(candidate) ? candidate : randomUUID();
  return {
    requestId,
    route: new URL(request.url).pathname,
    method: request.method,
    startedAt: Date.now(),
  };
}

export function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function redactText(value: string) {
  return value.replace(emailPattern, "[REDACTED_EMAIL]").replace(bearerPattern, "[REDACTED_AUTH]");
}

function redactValue(key: string, value: unknown): unknown {
  if (sensitiveKey.test(key)) return "[REDACTED]";
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
  if (value && typeof value === "object") return redactContext(value as LogContext);
  return value;
}

export function redactContext(context: LogContext = {}) {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [key, redactValue(key, value)])
  );
}

function baseLog(context: LogContext) {
  return { timestamp: new Date().toISOString(), ...redactContext(context) };
}

export function logError(event: string, error: unknown, context: LogContext = {}) {
  const exception = error instanceof Error ? error : new Error("Unknown error");
  const details = {
    level: "error",
    event,
    errorName: exception.name,
    message: redactText(exception.message),
    ...(process.env.NODE_ENV !== "production" && exception.stack
      ? { stack: redactText(exception.stack) }
      : {}),
    ...baseLog(context),
  };
  console.error(JSON.stringify(details));
}

export function logInfo(event: string, context: LogContext = {}) {
  console.info(JSON.stringify({ level: "info", event, ...baseLog(context) }));
}

export function logRequestError(
  event: string,
  error: unknown,
  request: RequestContext,
  context: LogContext = {}
) {
  logError(event, error, {
    ...request,
    durationMs: Date.now() - request.startedAt,
    ...context,
  });
}
