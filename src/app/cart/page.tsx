"use client";
import { cartProducts, useStore } from "@/context/store";
import Image from "next/image";
import { money } from "@/lib/catalog";
import { EmptyState } from "@/components/ui";
import { CartSummary } from "@/components/cart-summary";
import { QuantityStepper } from "@/components/quantity-stepper";
import { calculateOrderTotals } from "@/lib/order-rules";

export default function CartPage() {
  const { cart, products, updateQuantity, removeFromCart } = useStore();
  const lines = cartProducts(cart, products);
  const { subtotal, delivery } = calculateOrderTotals(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity }))
  );
  if (!lines.length)
    return (
      <section className="page">
        <EmptyState
          title="Your cart is feeling light."
          body="Add something fresh and we’ll take it from there."
        />
      </section>
    );
  return (
    <section className="page">
      <div className="page-intro">
        <div className="eyebrow">Your basket</div>
        <h1>Cart</h1>
      </div>
      <div className="two-column">
        <div>
          {lines.map((line) => (
            <div className="cart-line" key={line.productId}>
              <Image
                src={line.product.image}
                alt=""
                width={94}
                height={94}
                sizes="(max-width: 800px) 70px, 94px"
              />
              <div>
                <h3>{line.product.name}</h3>
                <p>
                  {line.product.unit} · {money(line.product.price)}
                </p>
                <QuantityStepper
                  quantity={line.quantity}
                  label={`${line.product.name} quantity`}
                  onDecrease={() => void updateQuantity(line.productId, line.quantity - 1)}
                  onIncrease={() => void updateQuantity(line.productId, line.quantity + 1)}
                />
                <button className="remove" onClick={() => void removeFromCart(line.productId)}>
                  Remove
                </button>
              </div>
              <strong>{money(line.product.price * line.quantity)}</strong>
            </div>
          ))}
        </div>
        <CartSummary
          subtotal={subtotal}
          delivery={delivery}
          checkoutHref="/checkout"
          showDeliveryNotice
        />
      </div>
    </section>
  );
}
