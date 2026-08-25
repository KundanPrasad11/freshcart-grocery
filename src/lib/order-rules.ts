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
