import { auth } from "@/auth";
import { apiError, isResponse, readJson } from "@/lib/http";
import { createRequestContext, logRequestError } from "@/lib/logger";
import { dummyPaymentSchema } from "@/lib/schemas";
import { getOrderForUser, markOrderPaid } from "@/lib/store-repository";
import { dummyPaymentsEnabled } from "@/lib/razorpay";

export async function POST(request: Request) {
  const context = createRequestContext(request);
  try {
    if (!dummyPaymentsEnabled()) return apiError(context, 404, "NOT_FOUND", "Not found.");
    const userId = (await auth())?.user?.id;
    if (!userId) return apiError(context, 401, "UNAUTHORIZED", "Unauthorized");
    const body = await readJson(request, dummyPaymentSchema, { maxBytes: 1024, requestContext: context });
    if (isResponse(body)) return body;
    const order = await getOrderForUser(userId, body.orderId);
    if (!order) return apiError(context, 404, "ORDER_NOT_FOUND", "Order not found.");
    await markOrderPaid(order.id, { provider: "dummy", paymentId: `dummy_${order.id}` });
    return Response.json({ ok: true, orderId: order.id });
  } catch (error) {
    logRequestError("checkout.dummy_failed", error, context);
    return apiError(context, 503, "DUMMY_PAYMENT_UNAVAILABLE", "Could not complete the test payment.");
  }
}
