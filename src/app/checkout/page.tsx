"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { cartProducts, useStore } from "@/context/store";
import { EmptyState } from "@/components/ui";
import { CheckoutForm, CheckoutOrderSummary } from "@/components/checkout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { money } from "@/lib/catalog";
import { calculateOrderTotals } from "@/lib/order-rules";

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  handler: (response: RazorpayResponse) => void;
  modal?: { ondismiss: () => void };
};
type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let razorpayScript: Promise<void> | null = null;
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpayScript) {
    razorpayScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
      document.head.appendChild(script);
    });
  }
  return razorpayScript;
}

export default function CheckoutPage() {
  const { cart, products, user, deliverySlots } = useStore();
  const lines = cartProducts(cart, products);
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState("");
  const [instructions, setInstructions] = useState("");
  const [slotId, setSlotId] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const { subtotal, delivery, total } = calculateOrderTotals(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity }))
  );

  useEffect(() => {
    if (!slotId && deliverySlots[0]) setSlotId(deliverySlots[0].id);
  }, [deliverySlots, slotId]);

  const updateAddress = (value: string) => {
    setAddress(value);
    setAddressError("");
  };
  const requestPaymentConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (address.trim().length < 10) {
      setAddressError("Enter a complete delivery address (at least 10 characters).");
      return;
    }
    if (!slotId) {
      setAddressError("Choose an available delivery time.");
      return;
    }
    setShowPaymentConfirm(true);
  };
  const confirmPayment = async () => {
    setPlacingOrder(true);
    const response = await fetch("/api/checkout/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, delivery: { slotId, ...(instructions ? { instructions } : {}) }, idempotencyKey }) });
    const result = await response.json();
    if (!response.ok) {
      setAddressError(result.error ?? "Could not start secure checkout. Please try again.");
      setPlacingOrder(false);
      setShowPaymentConfirm(false);
      return;
    }
    if (result.mode === "dummy") {
      await fetch("/api/checkout/dummy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: result.orderId }) });
      window.location.assign(`/checkout/success?order=${encodeURIComponent(result.orderId)}`);
      return;
    }
    try {
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay checkout could not start.");
      const checkout = new window.Razorpay({
        key: result.keyId,
        amount: result.amount,
        currency: result.currency,
        name: result.name,
        description: result.description,
        order_id: result.razorpayOrderId,
        prefill: result.prefill,
        handler: async (payment) => {
          const verified = await fetch("/api/checkout/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: result.orderId,
              razorpayOrderId: payment.razorpay_order_id,
              razorpayPaymentId: payment.razorpay_payment_id,
              razorpaySignature: payment.razorpay_signature,
            }),
          });
          if (!verified.ok) {
            setAddressError("Payment completed, but verification is pending. Please check My orders shortly.");
            setPlacingOrder(false);
            return;
          }
          window.location.assign(`/checkout/success?order=${encodeURIComponent(result.orderId)}`);
        },
        modal: { ondismiss: () => setPlacingOrder(false) },
      });
      checkout.open();
      setShowPaymentConfirm(false);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Could not start Razorpay checkout.");
      setPlacingOrder(false);
      setShowPaymentConfirm(false);
    }
  };

  if (!lines.length)
    return (
      <section className="page">
        <EmptyState title="No groceries to check out." body="Your cart is empty at the moment." />
      </section>
    );
  if (!user) return <SignInRequired />;

  return (
    <>
      <section className="page">
        <div className="page-intro">
          <div className="eyebrow">Secure checkout</div>
          <h1>Almost at your table.</h1>
        </div>
        <div className="two-column">
          <CheckoutForm
            address={address}
            addressError={addressError}
            instructions={instructions}
            deliverySlots={deliverySlots}
            slotId={slotId}
            total={total}
            onAddressChange={updateAddress}
            onInstructionsChange={setInstructions}
            onSlotChange={(value) => {
              setSlotId(value);
              setAddressError("");
            }}
            onSubmit={requestPaymentConfirmation}
          />
          <CheckoutOrderSummary lines={lines} delivery={delivery} />
        </div>
      </section>
      <ConfirmDialog
        open={showPaymentConfirm}
        title="Reserve your order"
        description={
          <>
            You are about to reserve this order for <strong>{money(total)}</strong>.
            Your groceries will be delivered to <strong>{address}</strong>.
          </>
        }
        confirmLabel={`Reserve ${money(total)}`}
        onCancel={() => setShowPaymentConfirm(false)}
        onConfirm={() => void confirmPayment()}
        busy={placingOrder}
      />
    </>
  );
}

function SignInRequired() {
  return (
    <section className="page">
      <div className="form-card">
        <div className="eyebrow">Almost there</div>
        <h1>Sign in to check out.</h1>
        <p>Use an account to keep delivery updates and your invoice in one place.</p>
        <Link className="button" href="/auth">
          Sign in or create account
        </Link>
      </div>
    </section>
  );
}
