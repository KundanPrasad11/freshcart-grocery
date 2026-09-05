import crypto from "crypto";
import Razorpay from "razorpay";

let client: Razorpay | undefined;

export function razorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay credentials are not configured.");
  if (!client) client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return client;
}

export function razorpayKeyId() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) throw new Error("RAZORPAY_KEY_ID is required.");
  return keyId;
}

export const toPaise = (rupees: number) => {
  if (!Number.isSafeInteger(rupees) || rupees < 0) throw new Error("Invalid INR amount.");
  return rupees * 100;
};

function safelyCompare(expected: string, received: string) {
  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(received, "hex");
  return expectedBytes.length === receivedBytes.length && crypto.timingSafeEqual(expectedBytes, receivedBytes);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safelyCompare(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safelyCompare(expected, signature);
}

export function dummyPaymentsEnabled() {
  return process.env.NODE_ENV !== "production" && (process.env.PAYMENTS_MODE === "dummy" || !process.env.RAZORPAY_KEY_ID);
}
