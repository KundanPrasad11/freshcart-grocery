import { escapeHtml } from "@/lib/http";
import { OrderDocument, OrderLineSnapshot } from "@/lib/models";

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export function createInvoiceEmailHtml(order: OrderDocument, lineItems: OrderLineSnapshot[]) {
  const receiptRows = lineItems
    .map(
      (item) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid #e6e8df">${item.quantity} × ${escapeHtml(item.name)}<br><span style="color:#64746f;font-size:12px">${escapeHtml(item.unit)}</span></td><td style="padding:12px 0;border-bottom:1px solid #e6e8df;text-align:right;font-weight:700">${money(item.lineTotal)}</td></tr>`
    )
    .join("");
  const deliveryFee = order.deliveryFee ?? (typeof order.delivery === "number" ? order.delivery : 0);
  return `<!doctype html><html><body style="margin:0;background:#fbfaf5;font-family:Arial,sans-serif;color:#18352e"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#18352e;color:#fff;padding:26px 30px;border-radius:14px 14px 0 0"><div style="font-size:24px;font-weight:800">FreshCart</div><p style="margin:8px 0 0;color:#d5dfd4">Order receipt</p></div><div style="background:#fff;padding:30px;border:1px solid #e6e8df;border-top:0;border-radius:0 0 14px 14px"><h1 style="font-family:Georgia,serif;font-size:30px;margin:0 0 8px">Thanks for your order.</h1><p style="color:#64746f;line-height:1.5">We're getting your groceries ready. Your invoice is attached for your records.</p><table style="width:100%;border-collapse:collapse;margin-top:20px"><tr><td><strong>Order ${escapeHtml(order.id)}</strong><br><span style="color:#64746f;font-size:13px">${escapeHtml(order.date)}</span></td><td style="text-align:right"><strong>${escapeHtml(order.status)}</strong></td></tr>${receiptRows}<tr><td style="padding:12px 0">Delivery</td><td style="text-align:right">${money(deliveryFee)}</td></tr><tr><td style="padding-top:16px;font-size:18px;font-weight:800">Total</td><td style="padding-top:16px;text-align:right;font-size:18px;font-weight:800">${money(order.total)}</td></tr></table><p style="margin-top:28px;padding-top:18px;border-top:1px solid #e6e8df;color:#64746f;font-size:13px;line-height:1.5">Delivery to: ${escapeHtml(order.address)}</p></div></div></body></html>`;
}
