import crypto from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import { toPaise, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

describe("Razorpay payment safeguards", () => {
  it("converts only safe whole-rupee amounts to paise", () => {
    expect(toPaise(499)).toBe(49_900);
    expect(() => toPaise(-1)).toThrow("Invalid INR amount");
    expect(() => toPaise(1.5)).toThrow("Invalid INR amount");
  });

  it("accepts only a checkout signature made with the server secret", () => {
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
    const signature = crypto.createHmac("sha256", "test-secret").update("order_123|pay_123").digest("hex");
    expect(verifyCheckoutSignature("order_123", "pay_123", signature)).toBe(true);
    expect(verifyCheckoutSignature("order_123", "pay_other", signature)).toBe(false);
  });

  it("validates the raw webhook body without parsing it first", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret";
    const raw = '{"event":"payment.captured"}';
    const signature = crypto.createHmac("sha256", "webhook-secret").update(raw).digest("hex");
    expect(verifyWebhookSignature(raw, signature)).toBe(true);
    expect(verifyWebhookSignature(`${raw} `, signature)).toBe(false);
  });
});
