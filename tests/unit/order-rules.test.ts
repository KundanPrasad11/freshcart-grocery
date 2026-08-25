import { describe, expect, it } from "vitest";
import { calculateOrderTotals, DELIVERY_FEE } from "@/lib/order-rules";

describe("calculateOrderTotals", () => {
  it("calculates a subtotal and the delivery fee below the free-delivery threshold", () => {
    expect(calculateOrderTotals([{ price: 349, quantity: 1 }])).toEqual({
      subtotal: 349,
      discount: 0,
      delivery: DELIVERY_FEE,
      total: 398,
    });
  });

  it("makes delivery free at the threshold", () => {
    expect(calculateOrderTotals([{ price: 333, quantity: 3 }])).toMatchObject({
      subtotal: 999,
      delivery: 0,
      total: 999,
    });
  });

  it("applies percentage discounts with integer rounding", () => {
    expect(calculateOrderTotals([{ price: 999, quantity: 1 }], {
      type: "percent", value: 15, minimumOrder: 500,
    })).toEqual({ subtotal: 999, discount: 149, delivery: 0, total: 850 });
  });

  it("does not apply a discount below its minimum order", () => {
    expect(calculateOrderTotals([{ price: 349, quantity: 1 }], {
      type: "fixed", value: 100, minimumOrder: 500,
    })).toMatchObject({ discount: 0, total: 398 });
  });

  it("caps a fixed discount at the subtotal", () => {
    expect(calculateOrderTotals([{ price: 100, quantity: 1 }], {
      type: "fixed", value: 500, minimumOrder: 0,
    })).toEqual({ subtotal: 100, discount: 100, delivery: 49, total: 49 });
  });
});
