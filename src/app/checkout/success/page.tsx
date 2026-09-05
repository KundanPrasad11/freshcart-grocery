"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/context/store";

export default function CheckoutSuccessPage() {
  const orderId = useSearchParams().get("order");
  const { orders } = useStore();
  const order = orders.find((candidate) => candidate.id === orderId);
  const paid = order?.payment?.status === "paid";
  return (
    <section className="page"><div className="success">
      <div className="eyebrow">Secure payment</div>
      <h1>{paid ? "Payment confirmed." : "Payment processing."}</h1>
      <p>{paid ? "Your order is paid and being prepared." : "Razorpay will confirm payment shortly. Refresh this page or view your orders for the latest status."}</p>
      <Link className="button" href="/orders">View my orders</Link>
    </div></section>
  );
}
