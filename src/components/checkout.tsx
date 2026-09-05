"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { DeliverySlot, Order } from "@/context/store";
import { money, Product } from "@/lib/catalog";

type CheckoutLine = { product: Product; quantity: number };

type CheckoutFormProps = {
  address: string;
  addressError: string;
  instructions: string;
  deliverySlots: DeliverySlot[];
  slotId: string;
  total: number;
  onAddressChange: (address: string) => void;
  onInstructionsChange: (instructions: string) => void;
  onSlotChange: (slotId: string) => void;
  onSubmit: (event: FormEvent) => void;
};

export function CheckoutForm({
  address,
  addressError,
  instructions,
  deliverySlots,
  slotId,
  total,
  onAddressChange,
  onInstructionsChange,
  onSlotChange,
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
        <span>Delivery time</span>
        <select required value={slotId} onChange={(event) => onSlotChange(event.target.value)}>
          <option value="" disabled>
            {deliverySlots.length ? "Choose a delivery time" : "Loading delivery times…"}
          </option>
          {deliverySlots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Delivery instructions (optional)</span>
        <input
          maxLength={300}
          value={instructions}
          onChange={(event) => onInstructionsChange(event.target.value)}
          placeholder="Leave at the security desk"
        />
      </label>
      <button className="button" type="submit">
        Continue to payment · {money(total)}
      </button>
      <p className="form-note">You will pay through Razorpay&apos;s secure checkout. FreshCart never receives card details.</p>
    </form>
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
        <div className="eyebrow">Delivery reserved</div>
        <h1>Your order is reserved.</h1>
        <p>
          Order <b>{order.id}</b> has a delivery slot reserved. We&apos;ll send updates to{" "}
          {email ?? "your email"}. Payment is still pending, so inventory has been held—not sold.
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
