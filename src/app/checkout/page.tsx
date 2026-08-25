"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { cartProducts, Order, useStore } from "@/context/store";
import { downloadInvoice, emailInvoice } from "@/lib/invoice";
import { EmptyState } from "@/components/ui";
import { CheckoutForm, CheckoutOrderSummary, CheckoutSuccess } from "@/components/checkout";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { money } from "@/lib/catalog";
import { calculateOrderTotals } from "@/lib/order-rules";

export default function CheckoutPage() {
  const { cart, products, user, placeOrder } = useStore();
  const lines = cartProducts(cart, products);
  const [order, setOrder] = useState<Order | null>(null);
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState("");
  const [payment, setPayment] = useState("card");
  const [emailStatus, setEmailStatus] = useState("");
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const { subtotal, delivery, total } = calculateOrderTotals(
    lines.map((line) => ({ price: line.product.price, quantity: line.quantity }))
  );

  const updateAddress = (value: string) => {
    setAddress(value);
    setAddressError("");
  };
  const sendInvoice = async (orderId: string) => {
    setEmailStatus("Sending…");
    const result = await emailInvoice(orderId);
    setEmailStatus(
      result.ok
        ? "Invoice emailed to your account address."
        : (result.message ?? "Invoice email could not be sent.")
    );
  };
  const requestPaymentConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (address.trim().length < 10) {
      setAddressError("Enter a complete delivery address (at least 10 characters).");
      return;
    }
    setShowPaymentConfirm(true);
  };
  const confirmPayment = async () => {
    setPlacingOrder(true);
    const placed = await placeOrder(address);
    if (!placed) {
      setAddressError(
        "We could not place this order. Please review your delivery address and try again."
      );
      setPlacingOrder(false);
      setShowPaymentConfirm(false);
      return;
    }
    setOrder(placed);
    setShowPaymentConfirm(false);
    await sendInvoice(placed.id);
    setPlacingOrder(false);
  };

  if (order)
    return (
      <CheckoutSuccess
        order={order}
        email={user?.email}
        emailStatus={emailStatus}
        onDownload={() => downloadInvoice(order, products)}
        onEmail={() => void sendInvoice(order.id)}
      />
    );
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
            payment={payment}
            total={total}
            onAddressChange={updateAddress}
            onPaymentChange={setPayment}
            onSubmit={requestPaymentConfirmation}
          />
          <CheckoutOrderSummary lines={lines} delivery={delivery} />
        </div>
      </section>
      <ConfirmDialog
        open={showPaymentConfirm}
        title="Confirm your payment"
        description={
          <>
            You are about to place this order for <strong>{money(total)}</strong>.
            Your groceries will be delivered to <strong>{address}</strong>.
          </>
        }
        confirmLabel={`Pay ${money(total)}`}
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
