import { ZodType } from "zod";
import { createRequestContext, logRequestError, RequestContext } from "@/lib/logger";

type ReadJsonOptions = { maxBytes?: number; requestContext?: RequestContext };

const DEFAULT_JSON_LIMIT = 32 * 1024;

export function apiError(
  request: RequestContext,
  status: number,
  code: string,
  error: string,
  headers: HeadersInit = {}
) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("x-request-id", request.requestId);
  return Response.json(
    { error, code, requestId: request.requestId },
    { status, headers: responseHeaders }
  );
}

function supportsJson(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  return contentType === "application/json" || Boolean(contentType?.endsWith("+json"));
}

export async function readJson<T>(
  request: Request,
  schema: ZodType<T>,
  options: ReadJsonOptions = {}
): Promise<T | Response> {
  const requestContext = options.requestContext ?? createRequestContext(request);
  const maxBytes = options.maxBytes ?? DEFAULT_JSON_LIMIT;
  if (!supportsJson(request))
    return apiError(
      requestContext,
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Request content type must be application/json."
    );
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes)
    return apiError(requestContext, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBytes)
      return apiError(requestContext, 413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
    body = JSON.parse(rawBody);
  } catch (error) {
    logRequestError("request.invalid_json", error, requestContext);
    return apiError(requestContext, 400, "MALFORMED_JSON", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return apiError(requestContext, 422, "VALIDATION_FAILED", "Request validation failed.");
  return parsed.data;
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!
  );
