"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number | null;
  rating: number;
  reviews: number;
  unit: string;
  badge: string;
  image: string;
  description: string;
  ingredients: string;
  nutrition: string;
  stockQuantity: number;
  reservedQuantity?: number;
  featured: boolean;
  active: boolean;
};
type Category = { id: string; name: string; emoji: string; description: string; active: boolean };
type Discount = { code: string; type: "percent" | "fixed"; value: number; minimumOrder: number; active: boolean };
type User = { id: string; name: string; email: string; role: "customer" | "admin" };
type DeliverySlot = { id: string; label: string; capacity: number; reservedCount: number };
type Order = {
  id: string;
  userId: string;
  total: number;
  status: string;
  fulfillmentStatus?: "awaiting_payment" | "processing" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
  address: string;
  date: string;
  delivery?: { address: string; instructions?: string; slot: { label: string } };
  payment?: { status: string };
  statusHistory?: { from: string | null; to: string; at: string; actor: string; reason?: string }[];
};
type AdminData = {
  products: Product[];
  categories: Category[];
  discounts: Discount[];
  users: User[];
  orders: Order[];
  deliverySlots: DeliverySlot[];
};

const blankProduct: Product = {
  id: "",
  slug: "",
  name: "",
  category: "Fresh Produce",
  price: 0,
  originalPrice: null,
  rating: 0,
  reviews: 0,
  unit: "1 unit",
  badge: "New",
  image: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
  description: "",
  ingredients: "",
  nutrition: "",
  stockQuantity: 0,
  featured: false,
  active: true,
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [product, setProduct] = useState<Product>(blankProduct);
  const [message, setMessage] = useState("Loading dashboard…");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "Unable to load admin data.");
      return;
    }
    setData(body as AdminData);
    setMessage("");
  }, []);
  useEffect(() => void load(), [load]);
  const save = async (payload: object) => {
    setMessage("Saving…");
    const response = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "Could not save the change.");
      return;
    }
    setMessage("Saved.");
    await load();
  };
  const submitProduct = (event: FormEvent) => {
    event.preventDefault();
    const { reservedQuantity, ...productForSave } = product;
    void save({ action: "product:upsert", product: productForSave });
  };
  if (!data)
    return (
      <section className="page">
        <div className="form-card">
          <h1>Admin dashboard</h1>
          <p>{message}</p>
        </div>
      </section>
    );
  return (
    <section className="page">
      <div className="page-intro">
        <div className="eyebrow">Operations</div>
        <h1>FreshCart admin</h1>
        <p>Manage catalog, inventory, promotions, customers, delivery capacity, and fulfillment.</p>
        {message && <div className="notice">{message}</div>}
      </div>
      <div className="two-column">
        <form className="checkout-card" onSubmit={submitProduct}>
          <h2>Catalog & inventory</h2>
          <label className="field">
            <span>Existing product</span>
            <select
              value={product.id}
              onChange={(event) => setProduct(data.products.find((item) => item.id === event.target.value) ?? blankProduct)}
            >
              <option value="">Create a product</option>
              {data.products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <div className="payment-fields">
            <Field label="Product ID" value={product.id} onChange={(id) => setProduct({ ...product, id })} />
            <Field label="Slug" value={product.slug} onChange={(slug) => setProduct({ ...product, slug })} />
          </div>
          <Field label="Name" value={product.name} onChange={(name) => setProduct({ ...product, name })} />
          <label className="field">
            <span>Category</span>
            <select value={product.category} onChange={(event) => setProduct({ ...product, category: event.target.value })}>
              {data.categories.map((category) => <option key={category.id}>{category.name}</option>)}
            </select>
          </label>
          <div className="payment-fields">
            <NumberField label="Price (₹)" value={product.price} onChange={(price) => setProduct({ ...product, price })} />
            <NumberField label="Physical stock" value={product.stockQuantity} onChange={(stockQuantity) => setProduct({ ...product, stockQuantity })} />
          </div>
          {product.reservedQuantity ? <p className="form-note">{product.reservedQuantity} unit(s) currently reserved by pending checkouts.</p> : null}
          <Field label="Unit" value={product.unit} onChange={(unit) => setProduct({ ...product, unit })} />
          <Field label="Badge" value={product.badge} onChange={(badge) => setProduct({ ...product, badge })} />
          <Field label="Image URL" value={product.image} onChange={(image) => setProduct({ ...product, image })} />
          <Field label="Description" value={product.description} onChange={(description) => setProduct({ ...product, description })} />
          <Field label="Ingredients" value={product.ingredients} onChange={(ingredients) => setProduct({ ...product, ingredients })} />
          <Field label="Nutrition" value={product.nutrition} onChange={(nutrition) => setProduct({ ...product, nutrition })} />
          <label><input type="checkbox" checked={product.featured} onChange={(event) => setProduct({ ...product, featured: event.target.checked })} /> Featured</label>{" "}
          <label><input type="checkbox" checked={product.active} onChange={(event) => setProduct({ ...product, active: event.target.checked })} /> Active</label>
          <button className="button" type="submit">Save product</button>
        </form>
        <div className="checkout-card">
          <h2>Categories</h2>
          <CategoryForm onSave={save} />
          <h2 className="payment-heading">Discounts</h2>
          <DiscountForm onSave={save} />
        </div>
      </div>
      <section className="page" style={{ padding: "56px 0" }}>
        <h2>Delivery capacity</h2>
        {data.deliverySlots.map((slot) => (
          <div className="order-card" key={slot.id}>
            <div className="order-top"><strong>{slot.label}</strong><span>{slot.reservedCount} / {slot.capacity} reserved</span></div>
          </div>
        ))}
        <h2 style={{ marginTop: 42 }}>Orders</h2>
        {data.orders.map((order) => <OrderOperations key={order.id} order={order} onSave={save} />)}
        <h2 style={{ marginTop: 42 }}>Users</h2>
        {data.users.map((user) => (
          <div className="order-card" key={user.id}>
            <div className="order-top">
              <div><h3>{user.name}</h3><p>{user.email}</p></div>
              <select value={user.role} onChange={(event) => void save({ action: "user:role", userId: user.id, role: event.target.value })}>
                <option value="customer">Customer</option><option value="admin">Admin</option>
              </select>
            </div>
          </div>
        ))}
      </section>
    </section>
  );
}

function OrderOperations({ order, onSave }: { order: Order; onSave: (value: object) => Promise<void> }) {
  const status = order.fulfillmentStatus ?? legacyStatus(order.status);
  return (
    <div className="order-card">
      <div className="order-top">
        <div>
          <h3>{order.id} · ₹{order.total}</h3>
          <p>{order.date} · {order.delivery?.address ?? order.address}</p>
          {order.delivery && <p>{order.delivery.slot.label}{order.delivery.instructions ? ` · ${order.delivery.instructions}` : ""}</p>}
          <p>Payment: {order.payment?.status ?? "legacy order"}</p>
        </div>
        <select value={status} onChange={(event) => void onSave({ action: "order:fulfillment", orderId: order.id, status: event.target.value })}>
          <option value="awaiting_payment">Awaiting payment</option>
          <option value="processing">Processing</option>
          <option value="packed">Packed</option>
          <option value="out_for_delivery">Out for delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {order.statusHistory?.length ? (
        <ol className="order-history" aria-label={`History for ${order.id}`}>
          {order.statusHistory.map((entry, index) => <li key={`${entry.at}-${index}`}>{entry.to.replaceAll("_", " ")} · {new Date(entry.at).toLocaleString("en-IN")}{entry.reason ? ` · ${entry.reason}` : ""}</li>)}
        </ol>
      ) : null}
    </div>
  );
}

function legacyStatus(status: string) {
  if (status === "Packed") return "packed";
  if (status === "Out for delivery") return "out_for_delivery";
  if (status === "Delivered") return "delivered";
  if (status === "Cancelled") return "cancelled";
  return "processing";
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input required value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="field"><span>{label}</span><input required type="number" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
function CategoryForm({ onSave }: { onSave: (value: object) => Promise<void> }) {
  const [category, setCategory] = useState({ id: "", name: "", emoji: "🏷️", description: "", active: true });
  return <form onSubmit={(event) => { event.preventDefault(); void onSave({ action: "category:upsert", category }); }}><Field label="Category ID" value={category.id} onChange={(id) => setCategory({ ...category, id })} /><Field label="Name" value={category.name} onChange={(name) => setCategory({ ...category, name })} /><Field label="Emoji" value={category.emoji} onChange={(emoji) => setCategory({ ...category, emoji })} /><Field label="Description" value={category.description} onChange={(description) => setCategory({ ...category, description })} /><button className="button" type="submit">Save category</button></form>;
}
function DiscountForm({ onSave }: { onSave: (value: object) => Promise<void> }) {
  const [discount, setDiscount] = useState({ code: "", type: "percent", value: 10, minimumOrder: 0, active: true });
  return <form onSubmit={(event) => { event.preventDefault(); void onSave({ action: "discount:upsert", discount }); }}><Field label="Code" value={discount.code} onChange={(code) => setDiscount({ ...discount, code })} /><label className="field"><span>Type</span><select value={discount.type} onChange={(event) => setDiscount({ ...discount, type: event.target.value })}><option value="percent">Percent</option><option value="fixed">Fixed ₹</option></select></label><NumberField label="Value" value={discount.value} onChange={(value) => setDiscount({ ...discount, value })} /><NumberField label="Minimum order" value={discount.minimumOrder} onChange={(minimumOrder) => setDiscount({ ...discount, minimumOrder })} /><button className="button" type="submit">Save discount</button></form>;
}
