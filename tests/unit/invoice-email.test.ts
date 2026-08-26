import { describe, expect, it } from "vitest";
import { createInvoiceEmailHtml } from "@/lib/invoice-email";
import { OrderDocument } from "@/lib/models";

describe("invoice email template", () => {
  it("renders immutable order snapshots and escapes their values", () => {
    const order: OrderDocument = {
      id: "FC-1234ABCD",
      userId: "user-1",
      date: "January 1, 2026",
      items: [{ productId: "legacy", quantity: 1 }],
      lineItems: [
        {
          productId: "apple",
          name: "<script>alert(1)</script>",
          unit: "1 kg",
          unitPrice: 100,
          quantity: 2,
          lineTotal: 200,
        },
      ],
      subtotal: 200,
      delivery: 49,
      discount: 0,
      total: 249,
      status: "Processing",
      address: "<b>12 MG Road</b>",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const html = createInvoiceEmailHtml(order, order.lineItems!);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;12 MG Road&lt;/b&gt;");
    expect(html).not.toContain("<script>");
  });
});
