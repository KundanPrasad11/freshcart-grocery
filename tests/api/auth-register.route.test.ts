import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { closeApiState, getDb, resetApiState } from "../support/api-test";
import { configureTestEnvironment } from "../support/test-environment";

const register = (body: unknown, ip = "198.51.100.8") => POST(new Request("http://test/api/auth/register", {
  method: "POST",
  headers: { "content-type": "application/json", "x-forwarded-for": ip },
  body: JSON.stringify(body),
}));

describe("POST /api/auth/register", () => {
  beforeAll(configureTestEnvironment);
  beforeEach(resetApiState);
  afterAll(closeApiState);

  it("creates a normalized account without storing the plain password", async () => {
    const response = await register({ name: "Jamie Rivera", email: " JAMIE@EXAMPLE.TEST ", password: "password123" });
    expect(response.status).toBe(201);
    const user = await (await getDb()).collection("users").findOne({ email: "jamie@example.test" });
    expect(user).toMatchObject({ name: "Jamie Rivera", email: "jamie@example.test" });
    expect(user?.passwordHash).not.toBe("password123");
  });

  it("rejects duplicate, malformed, and schema-invalid requests", async () => {
    const body = { name: "Jamie Rivera", email: "jamie@example.test", password: "password123" };
    expect((await register(body)).status).toBe(201);
    expect((await register(body)).status).toBe(409);
    expect((await POST(new Request("http://test/api/auth/register", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await register({ ...body, email: "not-an-email" })).status).toBe(422);
  });

  it("rate limits repeated registrations from one client", async () => {
    for (let index = 0; index < 5; index += 1) {
      expect((await register({ name: "Jamie Rivera", email: `jamie-${index}@example.test`, password: "password123" }, "203.0.113.5")).status).toBe(201);
    }
    const response = await register({ name: "Jamie Rivera", email: "jamie-6@example.test", password: "password123" }, "203.0.113.5");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });
});
