type InvoiceItem = { productId: string; quantity: number };
type InvoiceLine = {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};
type InvoiceOrder = {
  id: string;
  date: string;
  items: InvoiceItem[];
  lines?: InvoiceLine[];
  lineItems?: InvoiceLine[];
  total: number;
};
import { Product } from "@/lib/catalog";

const escapePdf = (text: string) => text.replace(/[()\\]/g, "\\$&").replace(/[^\x20-\x7E]/g, "");
export function createInvoicePdf(order: InvoiceOrder, products: Product[] = []) {
  const linesForInvoice =
    order.lines ??
    order.lineItems ??
    order.items.map((item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return {
        productId: item.productId,
        name: product?.name ?? item.productId,
        unitPrice: product?.price ?? 0,
        quantity: item.quantity,
        lineTotal: (product?.price ?? 0) * item.quantity,
      };
    });
  const lines = [
    "FRESHCART",
    "Grocery invoice",
    `Order ${order.id}`,
    `Placed ${order.date}`,
    "",
    ...linesForInvoice.map(
      (item) => `${item.quantity} x ${item.name}  Rs. ${item.lineTotal.toFixed(0)}`
    ),
    "",
    `TOTAL  Rs. ${order.total.toFixed(0)}`,
    "",
    "Thank you for shopping with FreshCart.",
  ];
  const content = `BT /F1 18 Tf 56 750 Td (${escapePdf(lines[0])}) Tj /F1 11 Tf 0 -30 Td ${lines
    .slice(1)
    .map((line) => `(${escapePdf(line)}) Tj 0 -20 Td`)
    .join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = pdf.length;
  return `${pdf}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}
