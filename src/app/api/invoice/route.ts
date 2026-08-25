import { auth } from "@/auth";
import { createInvoicePdf } from "@/lib/invoice-pdf";
import { getCatalog, getOrderForUser } from "@/lib/store-repository";
import { escapeHtml, isResponse, readJson } from "@/lib/http";
import { invoiceSchema } from "@/lib/schemas";
import { logError } from "@/lib/logger";

const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
const validSender = (value: string) =>
  /^(?:[^<>]+\s)?<[^<>\s]+@[^<>\s]+\.[^<>\s]+>$|^[^<>\s]+@[^<>\s]+\.[^<>\s]+$/.test(value);

function emailConfigurationError() {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const from = process.env.INVOICE_FROM?.trim() ?? "";
  if (!apiKey || /^re_x+$/i.test(apiKey) || !validSender(from))
    return "Email delivery is not configured. Set a real RESEND_API_KEY and a verified INVOICE_FROM address.";
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  const userId = session?.user?.id;
  if (!email || !userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request, invoiceSchema);
  if (isResponse(body)) return body;
  const order = await getOrderForUser(userId, body.orderId);
  if (!order) return Response.json({ error: "Order not found." }, { status: 404 });
  const configurationError = emailConfigurationError();
  if (configurationError) return Response.json({ error: configurationError }, { status: 503 });
  const recipient = process.env.NODE_ENV === "production"
    ? email
    : process.env.INVOICE_TEST_RECIPIENT?.trim() || email;

  try {
    const { products } = await getCatalog();
    const receiptRows = order.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      if (!product) return "";
      return `<tr><td style="padding:12px 0;border-bottom:1px solid #e6e8df">${item.quantity} × ${escapeHtml(product.name)}<br><span style="color:#64746f;font-size:12px">${escapeHtml(product.unit)}</span></td><td style="padding:12px 0;border-bottom:1px solid #e6e8df;text-align:right;font-weight:700">${money(product.price * item.quantity)}</td></tr>`;
    }).join("");
    const html = `<!doctype html><html><body style="margin:0;background:#fbfaf5;font-family:Arial,sans-serif;color:#18352e"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#18352e;color:#fff;padding:26px 30px;border-radius:14px 14px 0 0"><div style="font-size:24px;font-weight:800">FreshCart</div><p style="margin:8px 0 0;color:#d5dfd4">Order receipt</p></div><div style="background:#fff;padding:30px;border:1px solid #e6e8df;border-top:0;border-radius:0 0 14px 14px"><h1 style="font-family:Georgia,serif;font-size:30px;margin:0 0 8px">Thanks for your order.</h1><p style="color:#64746f;line-height:1.5">We're getting your groceries ready. Your invoice is attached for your records.</p><table style="width:100%;border-collapse:collapse;margin-top:20px"><tr><td><strong>Order ${escapeHtml(order.id)}</strong><br><span style="color:#64746f;font-size:13px">${escapeHtml(order.date)}</span></td><td style="text-align:right"><strong>${escapeHtml(order.status)}</strong></td></tr>${receiptRows}<tr><td style="padding:12px 0">Delivery</td><td style="text-align:right">${money(order.delivery)}</td></tr><tr><td style="padding-top:16px;font-size:18px;font-weight:800">Total</td><td style="padding-top:16px;text-align:right;font-size:18px;font-weight:800">${money(order.total)}</td></tr></table><p style="margin-top:28px;padding-top:18px;border-top:1px solid #e6e8df;color:#64746f;font-size:13px;line-height:1.5">Delivery to: ${escapeHtml(order.address)}</p></div></div></body></html>`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.INVOICE_FROM, to: [recipient], subject: `FreshCart receipt ${order.id}`, html, attachments: [{ filename: `${order.id}-invoice.pdf`, content: Buffer.from(createInvoicePdf(order, products)).toString("base64") }] }) });
    if (!response.ok) {
      logError("invoice.email_failed", new Error(`Resend returned ${response.status}`), { orderId: order.id, userId });
      if (response.status === 401)
        return Response.json(
          { error: "Email delivery is not authorized. Replace RESEND_API_KEY with an active key and restart the server." },
          { status: 503 }
        );
      if (response.status === 403)
        return Response.json(
          { error: "Resend blocked this recipient. For local testing, set INVOICE_TEST_RECIPIENT to your Resend account email; for production, verify your sender domain." },
          { status: 503 }
        );
      return Response.json({ error: "Invoice email could not be sent." }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    logError("invoice.send_failed", error, { orderId: order.id, userId });
    return Response.json({ error: "Invoice email could not be sent." }, { status: 503 });
  }
}
