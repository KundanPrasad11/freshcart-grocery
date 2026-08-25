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

export type Order = {
  id: string;
  date: string;
  items: CartItem[];
  total: number;
  status: "Processing" | "Packed" | "Out for delivery" | "Delivered" | "Cancelled";
  address: string;
};
type User = { name: string; email: string };
type ServerState = { cart: CartItem[]; wishlist: string[]; orders: Order[] };
type Store = ServerState & {
  products: Product[];
  categories: Category[];
  user: User | null;
  ready: boolean;
  addToCart: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeFromCart: (id: string) => Promise<void>;
  toggleWishlist: (id: string) => Promise<void>;
  placeOrder: (address: string, discountCode?: string) => Promise<Order | null>;
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
  const [state, setState] = useState<ServerState>({ cart: [], wishlist: [], orders: [] });
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
      } else setState({ cart: [], wishlist: [], orders: [] });
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
      placeOrder: async (address, discountCode) =>
        (
          await action({
            action: "order:create",
            address,
            ...(discountCode ? { discountCode } : {}),
          })
        )?.orders[0] ?? null,
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
