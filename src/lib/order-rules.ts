export const DELIVERY_THRESHOLD = 999;
export const DELIVERY_FEE = 49;

export type PricedOrderLine = { price: number; quantity: number };
export type EligibleDiscount = {
  type: "percent" | "fixed";
  value: number;
  minimumOrder: number;
};

export function calculateOrderTotals(lines: PricedOrderLine[], discount?: EligibleDiscount | null) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discountAmount = discount && subtotal >= discount.minimumOrder
    ? Math.min(
        subtotal,
        discount.type === "percent" ? Math.floor((subtotal * discount.value) / 100) : discount.value
      )
    : 0;
  const delivery = subtotal >= DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  return { subtotal, discount: discountAmount, delivery, total: subtotal + delivery - discountAmount };
}

/** The only fulfillment transitions available to staff and customer flows. */
export const fulfillmentTransitions: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  awaiting_payment: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransitionFulfillment(from: FulfillmentStatus, to: FulfillmentStatus) {
  return fulfillmentTransitions[from].includes(to);
}

/** Legacy presentation status, kept for old readers and documents during rollout. */
export function legacyOrderStatus(status: FulfillmentStatus): OrderStatus {
  switch (status) {
    case "packed":
      return "Packed";
    case "out_for_delivery":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return "Processing";
  }
}

export function isCustomerCancellable(status: FulfillmentStatus) {
  return status === "awaiting_payment" || status === "processing";
}
import { FulfillmentStatus, OrderStatus } from "@/lib/models";
