import Link from "next/link";
import { money } from "@/lib/catalog";

type CartSummaryProps = {
  subtotal: number;
  delivery: number;
  checkoutHref?: string;
  showDeliveryNotice?: boolean;
};

export function CartSummary({
  subtotal,
  delivery,
  checkoutHref,
  showDeliveryNotice = false,
}: CartSummaryProps) {
  return (
    <aside className="summary">
      <h2>{checkoutHref ? "Order summary" : "Your order"}</h2>
      <div>
        <span>Subtotal</span>
        <span>{money(subtotal)}</span>
      </div>
      <div>
        <span>Delivery</span>
        <span>{delivery ? money(delivery) : "Free"}</span>
      </div>
      <div className="total">
        <span>Total</span>
        <span>{money(subtotal + delivery)}</span>
      </div>
      {checkoutHref && (
        <Link className="button" href={checkoutHref}>
          Continue to checkout
        </Link>
      )}
      {showDeliveryNotice && <p className="summary-note">Free delivery on orders ₹999+</p>}
    </aside>
  );
}
