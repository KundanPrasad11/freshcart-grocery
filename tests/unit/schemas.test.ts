import { describe, expect, it } from "vitest";
import { invoiceSchema, registerSchema, storeActionSchema } from "@/lib/schemas";

describe("request schemas", () => {
  it("normalizes registration email addresses", () => {
    expect(registerSchema.parse({ name: "Jamie Rivera", email: " JAMIE@EXAMPLE.COM ", password: "password123" }).email)
      .toBe("jamie@example.com");
  });

  it("rejects weak registration payloads", () => {
    expect(registerSchema.safeParse({ name: "J", email: "bad", password: "short" }).success).toBe(false);
  });

  it("only accepts known store actions with safe quantities", () => {
    expect(storeActionSchema.safeParse({ action: "cart:update", productId: "avocados", quantity: -1 }).success).toBe(false);
    expect(storeActionSchema.safeParse({ action: "order:delete", orderId: "FC-123" }).success).toBe(false);
  });

  it("requires a FreshCart invoice identifier", () => {
    expect(invoiceSchema.safeParse({ orderId: "wrong" }).success).toBe(false);
    expect(invoiceSchema.safeParse({ orderId: "FC-1234ABCD" }).success).toBe(true);
  });
});
