"use client";
import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/context/store";
import { money } from "@/lib/catalog";
import { downloadInvoice } from "@/lib/invoice";
import { EmptyState } from "@/components/ui";

export default function OrdersPage() {
  const { orders, products, user, cancelOrder, reorderOrder } = useStore();
  const [message, setMessage] = useState("");
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
        {message && <div className="notice">{message}</div>}
      </div>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} products={products} onCancel={cancelOrder} onReorder={reorderOrder} onMessage={setMessage} />
      ))}
    </section>
  );
}

function OrderCard({
  order,
  products,
  onCancel,
  onReorder,
  onMessage,
}: {
  order: ReturnType<typeof useStore>["orders"][number];
  products: ReturnType<typeof useStore>["products"];
  onCancel: ReturnType<typeof useStore>["cancelOrder"];
  onReorder: ReturnType<typeof useStore>["reorderOrder"];
  onMessage: (message: string) => void;
}) {
  const delivery =
    order.delivery &&
    typeof order.delivery === "object" &&
    "slot" in order.delivery &&
    order.delivery.slot &&
    typeof order.delivery.slot.label === "string"
      ? order.delivery
      : undefined;
  return (
    <article className="order-card">
          <div className="order-top">
            <div>
              <h3>Order {order.id}</h3>
              <p>{order.date} · Delivered to {delivery?.address ?? order.address}</p>
              {delivery && <p>Delivery window: {delivery.slot.label}</p>}
              {delivery?.instructions && <p>Instructions: {delivery.instructions}</p>}
            </div>
            <span className="status">{order.status}</span>
          </div>
          <div className="order-items">
            {(order.lines ?? order.lineItems ?? order.items).map((item) => {
              const product = products.find((p) => p.id === item.productId);
              const name = "name" in item && typeof item.name === "string" ? item.name : product?.name ?? item.productId;
              return (
                <span key={item.productId}>
                  {item.quantity} × {name}&nbsp;&nbsp;{" "}
                </span>
              );
            })}
          </div>
          {order.statusHistory?.length ? (
            <ol className="order-history" aria-label="Order status history">
              {order.statusHistory.map((entry, index) => (
                <li key={`${entry.at}-${index}`}>
                  {entry.to.replaceAll("_", " ")} · {new Date(entry.at).toLocaleString("en-IN")}
                  {entry.reason ? ` · ${entry.reason}` : ""}
                </li>
              ))}
            </ol>
          ) : null}
          <div className="order-bottom">
            <strong>{money(order.total)}</strong>
            <button className="link-button" onClick={() => downloadInvoice(order, products)}>
              Download invoice PDF
            </button>
            <button
              className="link-button"
              onClick={() =>
                void onReorder(order.id).then((result) =>
                    onMessage(
                    result.error
                      ? result.error
                      : result.unavailable.length
                        ? `Added available items. Unavailable: ${result.unavailable.join(", ")}.`
                        : "Items added to your cart at current prices."
                  )
                )
              }
            >
              Reorder
            </button>
            {(order.fulfillmentStatus === "awaiting_payment" ||
              order.fulfillmentStatus === "processing" ||
              (!order.fulfillmentStatus && order.status === "Processing")) && (
              <button
                className="link-button"
                onClick={() =>
                  void onCancel(order.id).then((result) =>
                    onMessage(result ?? "Order cancelled and its inventory reservation released.")
                  )
                }
              >
                Cancel order
              </button>
            )}
          </div>
    </article>
  );
}
