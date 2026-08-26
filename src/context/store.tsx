"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { CartItem, Category, Product } from "@/lib/catalog";
import { OrderLineSnapshot } from "@/lib/models";

export type Order = {
  id: string;
  date: string;
  items: CartItem[];
  lines?: OrderLineSnapshot[];
  lineItems?: OrderLineSnapshot[];
  total: number;
  status: "Processing" | "Packed" | "Out for delivery" | "Delivered" | "Cancelled";
  address: string;
  delivery?: {
    address: string;
    instructions?: string;
    slot: { id: string; label: string; startsAt: string; endsAt: string; timezone: string };
  };
  payment?: { provider: "stripe"; status: "pending" | "paid" | "failed" | "refund_pending" | "refunded" };
  fulfillmentStatus?: "awaiting_payment" | "processing" | "packed" | "out_for_delivery" | "delivered" | "cancelled";
  statusHistory?: { from: string | null; to: string; at: string; actor: string; reason?: string }[];
  reservation?: { status: "active" | "released" | "expired" | "consumed"; expiresAt?: string };
};
export type DeliverySlot = { id: string; label: string; startsAt: string; endsAt: string; timezone: string };
type User = { name: string; email: string };
type ServerState = { cart: CartItem[]; wishlist: string[]; orders: Order[]; deliverySlots: DeliverySlot[] };
type Store = ServerState & {
  products: Product[];
  categories: Category[];
  user: User | null;
  ready: boolean;
  addToCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  toggleWishlist: (id: string) => Promise<void>;
  placeOrder: (delivery: { address: string; instructions?: string; slotId: string }, idempotencyKey: string, discountCode?: string) => Promise<Order | null>;
  cancelOrder: (orderId: string, reason?: string) => Promise<string | null>;
  reorderOrder: (orderId: string) => Promise<{ unavailable: string[]; error?: string }>;
};
const StoreContext = createContext<Store | null>(null);
type CatalogResponse = { products: Product[]; categories: Category[] };

// Shared across development's strict-mode remounts and session status updates.
let catalogRequest: Promise<CatalogResponse> | null = null;
function fetchCatalog() {
  if (!catalogRequest) {
    catalogRequest = fetch("/api/catalog", { cache: "force-cache" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog request failed.");
        return response.json() as Promise<CatalogResponse>;
      })
      .catch((error) => {
        catalogRequest = null;
        throw error;
      });
  }
  return catalogRequest;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [state, setState] = useState<ServerState>({ cart: [], wishlist: [], orders: [], deliverySlots: [] });
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ready, setReady] = useState(false);
  const user = session?.user?.email
    ? { name: session.user.name ?? "FreshCart shopper", email: session.user.email }
    : null;
  useEffect(() => {
    let active = true;
    void fetchCatalog()
      .then((catalog) => {
        if (!active) return;
        setProducts(catalog.products);
        setCategories(catalog.categories);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const load = useCallback(async () => {
    setReady(false);
    try {
      const stateRequest = user ? fetch("/api/store", { cache: "no-store" }) : null;
      if (stateRequest) {
        const stateResponse = await stateRequest;
        if (stateResponse.ok) setState((await stateResponse.json()) as ServerState);
      } else setState({ cart: [], wishlist: [], orders: [], deliverySlots: [] });
    } finally {
      setReady(status !== "loading");
    }
  }, [user?.email, status]);
  useEffect(() => {
    void load();
  }, [load]);
  const action = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!user) return null;
      const response = await fetch("/api/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return null;
      const next = (await response.json()) as ServerState;
      setState(next);
      return next;
    },
    [user]
  );
  const value = useMemo<Store>(
    () => ({
      ...state,
      products,
      categories,
      user,
      ready,
      addToCart: async (productId) => {
        await action({ action: "cart:add", productId });
      },
      updateQuantity: async (productId, quantity) => {
        await action({ action: "cart:update", productId, quantity });
      },
      removeFromCart: async (productId) => {
        await action({ action: "cart:update", productId, quantity: 0 });
      },
      toggleWishlist: async (productId) => {
        await action({ action: "wishlist:toggle", productId });
      },
      placeOrder: async (address, idempotencyKey, discountCode) =>
        (
          await action({
            action: "order:create",
            address: address.address,
            delivery: { slotId: address.slotId, ...(address.instructions ? { instructions: address.instructions } : {}) },
            idempotencyKey,
            ...(discountCode ? { discountCode } : {}),
          })
        )?.orders[0] ?? null,
      cancelOrder: async (orderId, reason) => {
        const response = await fetch("/api/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "order:cancel", orderId, ...(reason ? { reason } : {}) }),
        });
        const body = await response.json();
        if (!response.ok) return body.error ?? "Could not cancel this order.";
        setState(body.state as ServerState);
        return body.refundPending ? "Refund requested. The cancellation will finish once Stripe confirms it." : null;
      },
      reorderOrder: async (orderId) => {
        const response = await fetch("/api/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "order:reorder", orderId }),
        });
        const body = await response.json();
        if (!response.ok) return { unavailable: [], error: body.error ?? "Could not reorder this order." };
        setState(body.state as ServerState);
        return { unavailable: body.unavailable as string[] };
      },
    }),
    [state, products, categories, user, ready, action]
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
};
export const cartProducts = (cart: CartItem[], products: Product[]) =>
  cart
    .map((item) => ({
      ...item,
      product: products.find((product) => product.id === item.productId),
    }))
    .filter((item): item is CartItem & { product: Product } => Boolean(item.product));
