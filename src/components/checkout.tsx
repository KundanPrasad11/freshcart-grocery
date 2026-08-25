"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Order } from "@/context/store";
import { money, Product } from "@/lib/catalog";

type CheckoutLine = { product: Product; quantity: number };

type CheckoutFormProps = {
  address: string;
  addressError: string;
  payment: string;
  total: number;
  onAddressChange: (address: string) => void;
  onPaymentChange: (method: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function CheckoutForm({
  address,
  addressError,
  payment,
  total,
  onAddressChange,
  onPaymentChange,
  onSubmit,
}: CheckoutFormProps) {
  return (
    <form className="checkout-card" onSubmit={onSubmit}>
      <h2>Delivery details</h2>
      <label className="field">
        <span>Delivery address</span>
        <input
          required
          minLength={10}
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          placeholder="Flat 12, MG Road, Bengaluru, Karnataka 560001"
        />
      </label>
      {addressError && <div className="notice">{addressError}</div>}
      <label className="field">
        <span>Delivery instructions (optional)</span>
        <input placeholder="Leave at the security desk" />
      </label>
      <h2 className="payment-heading">Payment</h2>
      <div className="payment-options">
        <label>
          <input
            type="radio"
            checked={payment === "card"}
            onChange={() => onPaymentChange("card")}
          />
          Card
        </label>
        <label>
          <input
            type="radio"
            checked={payment === "wallet"}
            onChange={() => onPaymentChange("wallet")}
          />
          Digital wallet
        </label>
      </div>
      {payment === "card" && <CardFields />}
      <button className="button" type="submit">
        Place order · {money(total)}
      </button>
      <p className="form-note">Demo payment form — no card information is sent or stored.</p>
    </form>
  );
}

function CardFields() {
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const formatCardNumber = (value: string) =>
    value
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
  };
  return (
    <>
      <label className="field">
        <span>Card number</span>
        <input
          required
          inputMode="numeric"
          autoComplete="cc-number"
          maxLength={19}
          pattern="[0-9]{4}( [0-9]{4}){3}"
          value={cardNumber}
          onChange={(event) => setCardNumber(formatCardNumber(event.target.value))}
          placeholder="4242 4242 4242 4242"
        />
      </label>
      <div className="payment-fields">
        <label className="field">
          <span>Expiry</span>
          <input
            required
            inputMode="numeric"
            autoComplete="cc-exp"
            maxLength={7}
            pattern="(0[1-9]|1[0-2]) / [0-9]{2}"
            value={expiry}
            onChange={(event) => setExpiry(formatExpiry(event.target.value))}
            placeholder="08 / 28"
          />
        </label>
        <label className="field">
          <span>CVC</span>
          <input required inputMode="numeric" autoComplete="cc-csc" maxLength={4} pattern="[0-9]{3,4}" placeholder="123" />
        </label>
      </div>
    </>
  );
}

export function CheckoutOrderSummary({
  lines,
  delivery,
}: {
  lines: CheckoutLine[];
  delivery: number;
}) {
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  return (
    <aside className="summary">
      <h2>Your order</h2>
      {lines.map((line) => (
        <div key={line.product.id}>
          <span>
            {line.quantity} × {line.product.name}
          </span>
          <span>{money(line.quantity * line.product.price)}</span>
        </div>
      ))}
      <div>
        <span>Delivery</span>
        <span>{delivery ? money(delivery) : "Free"}</span>
      </div>
      <div className="total">
        <span>Total</span>
        <span>{money(subtotal + delivery)}</span>
      </div>
    </aside>
  );
}

export function CheckoutSuccess({
  order,
  email,
  emailStatus,
  onDownload,
  onEmail,
}: {
  order: Order;
  email?: string;
  emailStatus: string;
  onDownload: () => void;
  onEmail: () => void;
}) {
  return (
    <section className="page">
      <div className="success">
        <div className="eyebrow">Order confirmed</div>
        <h1>Thank you for your order.</h1>
        <p>
          Order <b>{order.id}</b> is in the kitchen. We&apos;ll send delivery updates to{" "}
          {email ?? "your email"}. Your invoice PDF is ready below.
        </p>
        <button className="button" onClick={onDownload}>
          Download invoice PDF
        </button>
        <button className="button lime" onClick={onEmail}>
          Email invoice
        </button>
        <Link className="button" href="/orders">
          View my orders
        </Link>
        {emailStatus && <div className="notice">{emailStatus}</div>}
      </div>
    </section>
  );
}
