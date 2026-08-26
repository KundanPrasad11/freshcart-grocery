import { describe, expect, it } from "vitest";
import { escapeHtml, isResponse, readJson } from "@/lib/http";
import { invoiceSchema } from "@/lib/schemas";

describe("HTTP safety helpers", () => {
  it("returns 400 for malformed JSON", async () => {
    const result = await readJson(
      new Request("http://test/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
      invoiceSchema
    );
    expect(isResponse(result)).toBe(true);
    if (isResponse(result)) {
      expect(result.status).toBe(400);
      await expect(result.json()).resolves.toMatchObject({
        code: "MALFORMED_JSON",
        requestId: expect.any(String),
      });
    }
  });

  it("returns 422 for schema-invalid JSON", async () => {
    const result = await readJson(
      new Request("http://test/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: "bad" }),
      }),
      invoiceSchema
    );
    expect(isResponse(result)).toBe(true);
    if (isResponse(result)) expect(result.status).toBe(422);
  });

  it("rejects non-JSON and oversized bodies before parsing", async () => {
    const plain = await readJson(
      new Request("http://test/api", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
      invoiceSchema
    );
    expect(isResponse(plain) && plain.status).toBe(415);
    const oversized = await readJson(
      new Request("http://test/api", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId: "FC-1234ABCD", extra: "x".repeat(200) }),
      }),
      invoiceSchema,
      { maxBytes: 32 }
    );
    expect(isResponse(oversized) && oversized.status).toBe(413);
  });

  it("escapes HTML-significant characters", () => {
    expect(escapeHtml(`<img src=x onerror='bad'>&\"`)).toBe(
      "&lt;img src=x onerror=&#39;bad&#39;&gt;&amp;&quot;"
    );
  });
});
