import bcrypt from "bcryptjs";
import { createUser } from "@/lib/store-repository";
import { apiError, isResponse, readJson } from "@/lib/http";
import { createRequestContext, logRequestError } from "@/lib/logger";
import { rateLimit, REGISTRATION_RATE_LIMIT } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const requestContext = createRequestContext(request);
  try {
    const body = await readJson(request, registerSchema, { maxBytes: 2 * 1024, requestContext });
    if (isResponse(body)) return body;
    // Registration is deliberately keyed to the trusted client IP only: using
    // the supplied email would let an attacker bypass the limit by rotating it.
    const limit = await rateLimit(request, REGISTRATION_RATE_LIMIT);
    if (!limit.success)
      return apiError(
        requestContext,
        429,
        "RATE_LIMITED",
        "Too many attempts. Please try again shortly.",
        { "Retry-After": String(limit.retryAfter) }
      );
    const user = await createUser(body.name, body.email, await bcrypt.hash(body.password, 12));
    if (!user)
      return apiError(
        requestContext,
        409,
        "ACCOUNT_EXISTS",
        "An account already exists for this email."
      );
    return Response.json(
      { ok: true, requestId: requestContext.requestId },
      { status: 201, headers: { "x-request-id": requestContext.requestId } }
    );
  } catch (error) {
    logRequestError("auth.registration_failed", error, requestContext);
    return apiError(
      requestContext,
      503,
      "REGISTRATION_UNAVAILABLE",
      "Unable to create account. Please try again."
    );
  }
}
