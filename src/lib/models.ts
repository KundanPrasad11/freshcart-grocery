import { CartItem, Product } from "@/lib/catalog";

export type UserRole = "customer" | "admin";
export type UserDocument = { id: string; name: string; email: string; passwordHash: string; role: UserRole; createdAt: Date };
export type CartDocument = { userId: string; items: CartItem[]; updatedAt: Date };
export type WishlistDocument = { userId: string; productIds: string[]; updatedAt: Date };
export type ProductDocument = Omit<Product, "inStock"> & { stockQuantity: number; active: boolean; createdAt: Date; updatedAt: Date };
export type CategoryDocument = { id: string; name: string; emoji: string; description: string; active: boolean; createdAt: Date; updatedAt: Date };
export type DiscountDocument = { code: string; type: "percent" | "fixed"; value: number; minimumOrder: number; active: boolean; createdAt: Date; updatedAt: Date };
export type OrderStatus = "Processing" | "Packed" | "Out for delivery" | "Delivered" | "Cancelled";
export type OrderDocument = { id: string; userId: string; date: string; items: CartItem[]; subtotal: number; delivery: number; discount: number; total: number; status: OrderStatus; address: string; discountCode?: string; createdAt: Date; updatedAt: Date };
