import { z } from "zod";

export const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
export const cartItemSchema = z.object({ productId: z.string().min(1).max(100), quantity: z.number().int().min(1).max(99) });
export const registerSchema = z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, password: z.string().min(8).max(128) });
export const storeActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cart:add"), productId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("cart:update"), productId: z.string().min(1).max(100), quantity: z.number().int().min(0).max(99) }),
  z.object({ action: z.literal("wishlist:toggle"), productId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("order:create"), address: z.string().trim().min(10).max(300), discountCode: z.string().trim().min(2).max(40).optional() }),
]);
export const invoiceSchema = z.object({ orderId: z.string().regex(/^FC-[A-Z0-9-]{8,}$/) });

const productFields = z.object({
  id: z.string().trim().min(2).max(100).regex(/^[a-z0-9-]+$/), slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/), name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(80), price: z.number().int().min(0).max(1_000_000), originalPrice: z.number().int().min(0).max(1_000_000).nullable(), rating: z.number().min(0).max(5).default(0), reviews: z.number().int().min(0).default(0), unit: z.string().trim().min(1).max(40), badge: z.string().trim().min(1).max(50), image: z.string().url().max(1000), description: z.string().trim().min(2).max(500), ingredients: z.string().trim().min(1).max(500), nutrition: z.string().trim().min(1).max(300), stockQuantity: z.number().int().min(0).max(1_000_000), featured: z.boolean().default(false), active: z.boolean().default(true),
});

export const adminActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("product:upsert"), product: productFields }),
  z.object({ action: z.literal("product:stock"), productId: z.string().min(1), stockQuantity: z.number().int().min(0).max(1_000_000) }),
  z.object({ action: z.literal("category:upsert"), category: z.object({ id: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/), name: z.string().trim().min(2).max(80), emoji: z.string().trim().min(1).max(12), description: z.string().trim().min(2).max(200), active: z.boolean().default(true) }) }),
  z.object({ action: z.literal("discount:upsert"), discount: z.object({ code: z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-Z0-9-]+$/), type: z.enum(["percent", "fixed"]), value: z.number().int().min(1).max(100_000), minimumOrder: z.number().int().min(0).max(1_000_000).default(0), active: z.boolean().default(true) }) }),
  z.object({ action: z.literal("order:status"), orderId: z.string().min(1), status: z.enum(["Processing", "Packed", "Out for delivery", "Delivered", "Cancelled"]) }),
  z.object({ action: z.literal("user:role"), userId: z.string().min(1), role: z.enum(["customer", "admin"]) }),
]);
