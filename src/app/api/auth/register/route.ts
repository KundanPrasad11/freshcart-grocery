import bcrypt from "bcryptjs";
import { createUser } from "@/lib/store-repository";
import { isResponse, readJson } from "@/lib/http";
import { logError } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const limited = rateLimit(request, "auth.register", 5, 15 * 60_000);
  if (limited) return limited;
  const body = await readJson(request, registerSchema);
  if (isResponse(body)) return body;
  try {
    const user = await createUser(body.name, body.email, await bcrypt.hash(body.password, 12));
    if (!user) return Response.json({ error: "An account already exists for this email." }, { status: 409 });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    logError("auth.registration_failed", error, { email: body.email });
    return Response.json({ error: "Unable to create account. Please try again." }, { status: 503 });
  }
}
