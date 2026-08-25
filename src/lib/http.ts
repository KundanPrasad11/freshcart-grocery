import { ZodType } from "zod";
import { logError } from "@/lib/logger";

export async function readJson<T>(request: Request, schema: ZodType<T>): Promise<T | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    logError("request.invalid_json", error, { path: new URL(request.url).pathname });
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { error: "Request validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  return parsed.data;
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export const escapeHtml = (value: string) =>
  value.replace(/[&<>'"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!
  );
