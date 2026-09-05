import { logError, logInfo } from "@/lib/logger";
import {
  claimInvoiceSend,
  claimProcessedWebhook,
  getOrderByRazorpayOrderId,
  markOrderPaid,
  releaseReservationAfterPaymentFailure,
} from "@/lib/store-repository";
import { verifyWebhookSignature } from "@/lib/razorpay";

type RazorpayWebhook = {
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    order?: { entity?: { id?: string } };
  };
};

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  const rawBody = await request.text();
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    logInfo("razorpay.webhook_signature_invalid");
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  let event: RazorpayWebhook;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhook;
  } catch (error) {
    logError("razorpay.webhook_malformed", error);
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId) return Response.json({ error: "Missing webhook event id." }, { status: 400 });
  try {
    if (!(await claimProcessedWebhook(`razorpay:${eventId}`))) return Response.json({ received: true, duplicate: true });
    const razorpayOrderId = event.payload?.payment?.entity?.order_id ?? event.payload?.order?.entity?.id;
    if (!razorpayOrderId) return Response.json({ received: true });
    const order = await getOrderByRazorpayOrderId(razorpayOrderId);
    if (!order) return Response.json({ received: true });
    if (event.event === "payment.captured" || event.event === "order.paid") {
      const paymentId = event.payload?.payment?.entity?.id;
      await markOrderPaid(order.id, { provider: "razorpay", razorpayOrderId, ...(paymentId ? { paymentId } : {}) });
      if (await claimInvoiceSend(order.id)) logInfo("invoice.send_queued", { orderId: order.id, source: "razorpay" });
    }
    if (event.event === "payment.failed") await releaseReservationAfterPaymentFailure(order.id, "Razorpay payment failed");
    return Response.json({ received: true });
  } catch (error) {
    logError("razorpay.webhook_failed", error, { event: event.event, eventId });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
