import { auth } from "@/auth";
import { apiError, isResponse, readJson } from "@/lib/http";
import { createRequestContext, logRequestError } from "@/lib/logger";
import { razorpayPaymentVerificationSchema } from "@/lib/schemas";
import { getOrderForUser, markOrderPaid } from "@/lib/store-repository";
import { verifyCheckoutSignature } from "@/lib/razorpay";

export async function POST(request: Request) {
  const context = createRequestContext(request);
  try {
    const userId = (await auth())?.user?.id;
    if (!userId) return apiError(context, 401, "UNAUTHORIZED", "Unauthorized");
    const body = await readJson(request, razorpayPaymentVerificationSchema, { maxBytes: 2 * 1024, requestContext: context });
    if (isResponse(body)) return body;
    const order = await getOrderForUser(userId, body.orderId);
    if (!order || order.payment?.razorpayOrderId !== body.razorpayOrderId)
      return apiError(context, 404, "ORDER_NOT_FOUND", "Order not found.");
    if (!verifyCheckoutSignature(body.razorpayOrderId, body.razorpayPaymentId, body.razorpaySignature))
      return apiError(context, 400, "INVALID_PAYMENT_SIGNATURE", "Payment could not be verified.");
    await markOrderPaid(order.id, {
      provider: "razorpay",
      razorpayOrderId: body.razorpayOrderId,
      paymentId: body.razorpayPaymentId,
    });
    return Response.json({ ok: true, orderId: order.id });
  } catch (error) {
    logRequestError("checkout.razorpay_verify_failed", error, context);
    return apiError(context, 503, "PAYMENT_VERIFICATION_UNAVAILABLE", "Payment verification is temporarily unavailable.");
  }
}
