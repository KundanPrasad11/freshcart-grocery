import { describe, expect, it } from "vitest";
import { escapeHtml, isResponse, readJson } from "@/lib/http";
import { invoiceSchema } from "@/lib/schemas";

describe("HTTP safety helpers", () => {
  it("returns 400 for malformed JSON", async () => {
    const result = await readJson(new Request("http://test/api", { method: "POST", body: "{" }), invoiceSchema);
    expect(isResponse(result)).toBe(true);
    if (isResponse(result)) expect(result.status).toBe(400);
  });

  it("returns 422 for schema-invalid JSON", async () => {
    const result = await readJson(new Request("http://test/api", { method: "POST", body: JSON.stringify({ orderId: "bad" }) }), invoiceSchema);
    expect(isResponse(result)).toBe(true);
    if (isResponse(result)) expect(result.status).toBe(422);
  });

  it("escapes HTML-significant characters", () => {
    expect(escapeHtml(`<img src=x onerror='bad'>&\"`)).toBe("&lt;img src=x onerror=&#39;bad&#39;&gt;&amp;&quot;");
  });
});
