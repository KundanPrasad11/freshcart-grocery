"use client";
import Link from "next/link";
import { useStore } from "@/context/store";
import { money } from "@/lib/catalog";
import { downloadInvoice } from "@/lib/invoice";
import { EmptyState } from "@/components/ui";

export default function OrdersPage() {
  const { orders, products, user } = useStore();
  if (!user)
    return (
      <section className="page">
        <div className="form-card">
          <div className="eyebrow">Your account</div>
          <h1>See your past orders.</h1>
          <p>Sign in to review delivery status and download order invoices.</p>
          <Link className="button" href="/auth">
            Sign in
          </Link>
        </div>
      </section>
    );
  if (!orders.length)
    return (
      <section className="page">
        <EmptyState title="No orders yet." body="Your completed orders will live here." />
      </section>
    );
  return (
    <section className="page">
      <div className="page-intro">
        <div className="eyebrow">Your account</div>
        <h1>Past orders</h1>
        <p>Everything you&apos;ve brought home from FreshCart.</p>
      </div>
      {orders.map((order) => (
        <article className="order-card" key={order.id}>
          <div className="order-top">
            <div>
              <h3>Order {order.id}</h3>
              <p>
                {order.date} · Delivered to {order.address}
              </p>
            </div>
            <span className="status">{order.status}</span>
          </div>
          <div className="order-items">
            {order.items.map((item) => {
              const product = products.find((p) => p.id === item.productId)!;
              return (
                <span key={item.productId}>
                  {item.quantity} × {product.name}&nbsp;&nbsp;{" "}
                </span>
              );
            })}
          </div>
          <div className="order-bottom">
            <strong>{money(order.total)}</strong>
            <button className="link-button" onClick={() => downloadInvoice(order, products)}>
              Download invoice PDF
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
