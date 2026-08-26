import { auth } from "@/auth";
import { apiError, isResponse, readJson } from "@/lib/http";
import { createInvoiceEmailHtml } from "@/lib/invoice-email";
import { createInvoicePdf } from "@/lib/invoice-pdf";
import { createRequestContext, logRequestError } from "@/lib/logger";
import { OrderDocument, OrderLineSnapshot } from "@/lib/models";
import { INVOICE_RATE_LIMIT, rateLimit } from "@/lib/rate-limit";
import { getCatalog, getOrderForUser } from "@/lib/store-repository";
import { invoiceSchema } from "@/lib/schemas";

const validSender = (value: string) =>
  /^(?:[^<>]+\s)?<[^<>\s]+@[^<>\s]+\.[^<>\s]+>$|^[^<>\s]+@[^<>\s]+\.[^<>\s]+$/.test(value);

function emailConfigurationError() {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.INVOICE_FROM?.trim() ?? "";
  if (!apiKey || /^re_x+$/i.test(apiKey) || !validSender(from))
    return "Email delivery is not configured. Set a real RESEND_API_KEY and a verified INVOICE_FROM address.";
  return null;
}

async function invoiceLines(order: OrderDocument): Promise<{
  lines: OrderLineSnapshot[];
  products: Awaited<ReturnType<typeof getCatalog>>["products"];
}> {
  if (order.lineItems?.length) return { lines: order.lineItems, products: [] };
  // Legacy orders predate snapshots. Keep them readable until a backfill can be run.
  const { products } = await getCatalog();
  return {
    products,
    lines: order.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return {
        productId: item.productId,
        name: product?.name ?? item.productId,
        unit: product?.unit ?? "Item",
        unitPrice: product?.price ?? 0,
        quantity: item.quantity,
        lineTotal: (product?.price ?? 0) * item.quantity,
      };
    }),
  };
}

export async function POST(request: Request) {
  const requestContext = createRequestContext(request);
  try {
    const session = await auth();
    const email = session?.user?.email?.toLowerCase();
    const userId = session?.user?.id;
    if (!email || !userId) return apiError(requestContext, 401, "UNAUTHORIZED", "Unauthorized");

    const body = await readJson(request, invoiceSchema, { maxBytes: 1024, requestContext });
    if (isResponse(body)) return body;
    const limit = await rateLimit(request, INVOICE_RATE_LIMIT, userId);
    if (!limit.success)
      return apiError(
        requestContext,
        429,
        "RATE_LIMITED",
        "Too many invoice requests. Please try again shortly.",
        { "Retry-After": String(limit.retryAfter) }
      );

    const order = await getOrderForUser(userId, body.orderId);
    if (!order) return apiError(requestContext, 404, "ORDER_NOT_FOUND", "Order not found.");
    const configurationError = emailConfigurationError();
    if (configurationError)
      return apiError(requestContext, 503, "EMAIL_NOT_CONFIGURED", configurationError);
    const recipient =
      process.env.NODE_ENV === "production"
        ? email
        : process.env.INVOICE_TEST_RECIPIENT?.trim() || email;
    const { lines, products } = await invoiceLines(order);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          from: process.env.INVOICE_FROM,
          to: [recipient],
          subject: `FreshCart receipt ${order.id}`,
          html: createInvoiceEmailHtml(order, lines),
          attachments: [
            {
              filename: `${order.id}-invoice.pdf`,
              content: Buffer.from(createInvoicePdf(order, products)).toString("base64"),
            },
          ],
        }),
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response!.ok) {
      logRequestError(
        "invoice.email_failed",
        new Error(`Resend returned ${response!.status}`),
        requestContext,
        { orderId: order.id, userId, providerStatus: response!.status }
      );
      if (response!.status === 401)
        return apiError(
          requestContext,
          503,
          "EMAIL_NOT_AUTHORIZED",
          "Email delivery is not authorized. Replace RESEND_API_KEY with an active key and restart the server."
        );
      if (response!.status === 403)
        return apiError(
          requestContext,
          503,
          "EMAIL_RECIPIENT_BLOCKED",
          "Resend blocked this recipient. For local testing, set INVOICE_TEST_RECIPIENT to your Resend account email; for production, verify your sender domain."
        );
      return apiError(
        requestContext,
        502,
        "EMAIL_PROVIDER_FAILED",
        "Invoice email could not be sent."
      );
    }
    return Response.json(
      { ok: true, requestId: requestContext.requestId },
      { headers: { "x-request-id": requestContext.requestId } }
    );
  } catch (error) {
    logRequestError("invoice.send_failed", error, requestContext);
    return apiError(requestContext, 503, "INVOICE_UNAVAILABLE", "Invoice email could not be sent.");
  }
}
