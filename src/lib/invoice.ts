import { Order } from "@/context/store";
import { createInvoicePdf } from "@/lib/invoice-pdf";
import { Product } from "@/lib/catalog";

export function downloadInvoice(order: Order, products: Product[]) {
  const url = URL.createObjectURL(new Blob([createInvoicePdf(order, products)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${order.id}-invoice.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
export async function emailInvoice(orderId: string) {
  const response = await fetch("/api/invoice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const body = await response.json();
  return { ok: response.ok, message: body.error as string | undefined };
}
