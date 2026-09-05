import { auth } from "@/auth";
import { apiError, isResponse, readJson } from "@/lib/http";
import { createRequestContext, logRequestError } from "@/lib/logger";
import { checkoutSessionSchema } from "@/lib/schemas";
import { attachRazorpayOrder, createOrder, findUserByEmail, getOrderForUser } from "@/lib/store-repository";
import { dummyPaymentsEnabled, razorpay, razorpayKeyId, toPaise } from "@/lib/razorpay";

export async function POST(request: Request) {
  const context = createRequestContext(request);
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const email = session?.user?.email;
    if (!userId || !email) return apiError(context, 401, "UNAUTHORIZED", "Unauthorized");
    const body = await readJson(request, checkoutSessionSchema, { maxBytes: 4 * 1024, requestContext: context });
    if (isResponse(body)) return body;
    const created = await createOrder(userId, {
      address: body.address,
      instructions: body.delivery.instructions,
      slotId: body.delivery.slotId,
      idempotencyKey: body.idempotencyKey,
      discountCode: body.discountCode,
    });
    if ("error" in created && created.error) return apiError(context, 409, "CHECKOUT_REJECTED", created.error);
    if (!("order" in created) || !created.order) return apiError(context, 503, "ORDER_UNAVAILABLE", "Could not prepare your order.");
    const order = await getOrderForUser(userId, created.order.id);
    if (!order) return apiError(context, 503, "ORDER_UNAVAILABLE", "Could not prepare your order.");
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      if (!dummyPaymentsEnabled()) return apiError(context, 503, "PAYMENTS_UNAVAILABLE", "Payments are not configured.");
      return Response.json({ mode: "dummy", orderId: order.id });
    }

    let razorpayOrderId = order.payment?.razorpayOrderId;
    if (!razorpayOrderId) {
      const user = await findUserByEmail(email);
      const providerOrder = await razorpay().orders.create({
        amount: toPaise(order.total),
        currency: "INR",
        receipt: order.id,
        notes: { freshcart_order_id: order.id, customer_email: user?.email ?? email },
      });
      razorpayOrderId = providerOrder.id;
      await attachRazorpayOrder(userId, order.id, razorpayOrderId);
    }

    return Response.json({
      mode: "razorpay",
      orderId: order.id,
      razorpayOrderId,
      amount: toPaise(order.total),
      currency: "INR",
      keyId: razorpayKeyId(),
      name: "FreshCart",
      description: `FreshCart order ${order.id}`,
      prefill: { name: session.user?.name ?? undefined, email },
    });
  } catch (error) {
    logRequestError("checkout.razorpay_session_failed", error, context);
    return apiError(context, 503, "CHECKOUT_UNAVAILABLE", "Checkout is temporarily unavailable.");
  }
}
