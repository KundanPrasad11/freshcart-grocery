import crypto from "crypto";
import seedProducts from "@/data/products.json";
import { getDb } from "@/lib/db";
import { logInfo } from "@/lib/logger";
import {
  CartDocument,
  CategoryDocument,
  DiscountDocument,
  OrderDocument,
  OrderStatus,
  ProductDocument,
  UserDocument,
  UserRole,
  WishlistDocument,
} from "@/lib/models";
import { CartItem, Category, Product } from "@/lib/catalog";
import { calculateOrderTotals } from "@/lib/order-rules";

export type StoreState = { cart: CartItem[]; wishlist: string[]; orders: PublicOrder[] };
export type PublicOrder = Pick<OrderDocument, "id" | "date" | "items" | "total" | "status" | "address">;

const categorySeed: Omit<CategoryDocument, "createdAt" | "updatedAt">[] = [
  { id: "fresh-produce", name: "Fresh Produce", emoji: "🥬", description: "Fruit & vegetables", active: true },
  { id: "dairy-eggs", name: "Dairy & Eggs", emoji: "🥛", description: "Farm-fresh staples", active: true },
  { id: "bakery", name: "Bakery", emoji: "🥖", description: "Baked this morning", active: true },
  { id: "pantry", name: "Pantry", emoji: "🫙", description: "Kitchen essentials", active: true },
  { id: "meat-seafood", name: "Meat & Seafood", emoji: "🐟", description: "Responsibly sourced", active: true },
];

let initialized: Promise<void> | undefined;

export function resetRepositoryForTests() {
  initialized = undefined;
}

async function collections() {
  const db = await getDb();
  return {
    users: db.collection<UserDocument>("users"),
    carts: db.collection<CartDocument>("carts"),
    wishlists: db.collection<WishlistDocument>("wishlists"),
    products: db.collection<ProductDocument>("products"),
    categories: db.collection<CategoryDocument>("categories"),
    discounts: db.collection<DiscountDocument>("discounts"),
    orders: db.collection<OrderDocument>("orders"),
  };
}

export async function ensureDatabase() {
  if (!initialized) {
    initialized = (async () => {
      const db = await collections();
      await Promise.all([
        db.users.createIndex({ email: 1 }, { unique: true }),
        db.carts.createIndex({ userId: 1 }, { unique: true }),
        db.wishlists.createIndex({ userId: 1 }, { unique: true }),
        db.products.createIndex({ id: 1 }, { unique: true }),
        db.products.createIndex({ slug: 1 }, { unique: true }),
        db.categories.createIndex({ id: 1 }, { unique: true }),
        db.discounts.createIndex({ code: 1 }, { unique: true }),
        db.orders.createIndex({ id: 1 }, { unique: true }),
        db.orders.createIndex({ userId: 1, createdAt: -1 }),
      ]);
      if ((await db.products.countDocuments()) === 0) {
        const now = new Date();
        await db.products.insertMany(
          seedProducts.map((product) => ({ ...product, stockQuantity: product.inStock ? 30 : 0, active: true, createdAt: now, updatedAt: now }))
        );
        await db.categories.insertMany(categorySeed.map((category) => ({ ...category, createdAt: now, updatedAt: now })));
        logInfo("database.catalog_seeded", { products: seedProducts.length });
      }
    })();
  }
  return initialized;
}

const publicProduct = (product: ProductDocument): Product => {
  const { stockQuantity, active, createdAt, updatedAt, ...publicFields } = product;
  return { ...publicFields, inStock: stockQuantity > 0 };
};
const publicOrder = (order: OrderDocument): PublicOrder => ({ id: order.id, date: order.date, items: order.items, total: order.total, status: order.status, address: order.address });

export async function getCatalog() {
  await ensureDatabase();
  const db = await collections();
  const [products, categoryDocs] = await Promise.all([
    db.products.find({ active: true }).sort({ featured: -1, name: 1 }).toArray(),
    db.categories.find({ active: true }).sort({ name: 1 }).toArray(),
  ]);
  return {
    products: products.map(publicProduct),
    categories: categoryDocs.map(({ id, name, emoji, description }) => ({ id, name, emoji, description }) satisfies Category),
  };
}

export async function findUserByEmail(email: string) {
  await ensureDatabase();
  return (await collections()).users.findOne({ email: email.toLowerCase() });
}

export async function createUser(name: string, email: string, passwordHash: string) {
  await ensureDatabase();
  const db = await collections();
  const normalizedEmail = email.toLowerCase();
  const user: UserDocument = {
    id: crypto.randomUUID(), name, email: normalizedEmail, passwordHash,
    role: process.env.ADMIN_EMAIL?.toLowerCase() === normalizedEmail ? "admin" : "customer",
    createdAt: new Date(),
  };
  try {
    await db.users.insertOne(user);
    await Promise.all([
      db.carts.insertOne({ userId: user.id, items: [], updatedAt: new Date() }),
      db.wishlists.insertOne({ userId: user.id, productIds: [], updatedAt: new Date() }),
    ]);
    logInfo("user.created", { userId: user.id, role: user.role });
    return user;
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === 11000) return null;
    throw error;
  }
}

export async function getState(userId: string): Promise<StoreState> {
  await ensureDatabase();
  const db = await collections();
  const [cart, wishlist, orders] = await Promise.all([
    db.carts.findOne({ userId }), db.wishlists.findOne({ userId }), db.orders.find({ userId }).sort({ createdAt: -1 }).toArray(),
  ]);
  return { cart: cart?.items ?? [], wishlist: wishlist?.productIds ?? [], orders: orders.map(publicOrder) };
}

export async function addToCart(userId: string, productId: string) {
  await ensureDatabase();
  const db = await collections();
  const product = await db.products.findOne({ id: productId, active: true, stockQuantity: { $gt: 0 } });
  if (!product) return null;
  const updated = await db.carts.updateOne({ userId, "items.productId": productId }, { $inc: { "items.$.quantity": 1 }, $set: { updatedAt: new Date() } });
  if (!updated.matchedCount) await db.carts.updateOne({ userId }, { $push: { items: { productId, quantity: 1 } }, $set: { updatedAt: new Date() } }, { upsert: true });
  return getState(userId);
}

export async function updateCart(userId: string, productId: string, quantity: number) {
  await ensureDatabase();
  const db = await collections();
  if (quantity < 1) await db.carts.updateOne({ userId }, { $pull: { items: { productId } }, $set: { updatedAt: new Date() } });
  else {
    const product = await db.products.findOne({ id: productId, active: true, stockQuantity: { $gt: 0 } });
    if (!product) return null;
    await db.carts.updateOne({ userId, "items.productId": productId }, { $set: { "items.$.quantity": quantity, updatedAt: new Date() } });
  }
  return getState(userId);
}

export async function toggleWishlist(userId: string, productId: string) {
  await ensureDatabase();
  const db = await collections();
  const product = await db.products.findOne({ id: productId, active: true });
  if (!product) return null;
  const wishlist = await db.wishlists.findOne({ userId });
  const productIds = wishlist?.productIds ?? [];
  const next = productIds.includes(productId) ? productIds.filter((id) => id !== productId) : [...productIds, productId];
  await db.wishlists.updateOne({ userId }, { $set: { productIds: next, updatedAt: new Date() } }, { upsert: true });
  return getState(userId);
}

export async function createOrder(userId: string, address: string, discountCode?: string) {
  await ensureDatabase();
  const db = await collections();
  const cart = await db.carts.findOne({ userId });
  if (!cart?.items.length) return { error: "Your cart is empty." } as const;
  const productIds = cart.items.map((item) => item.productId);
  const products = await db.products.find({ id: { $in: productIds }, active: true }).toArray();
  if (products.length !== productIds.length) return { error: "One or more products are no longer available." } as const;
  const byId = new Map(products.map((product) => [product.id, product]));
  if (cart.items.some((item) => (byId.get(item.productId)?.stockQuantity ?? 0) < item.quantity)) return { error: "One or more products no longer have enough stock." } as const;
  const discount = discountCode ? await db.discounts.findOne({ code: discountCode.toUpperCase(), active: true }) : null;
  const totals = calculateOrderTotals(
    cart.items.map((item) => ({ price: byId.get(item.productId)!.price, quantity: item.quantity })),
    discount
  );
  const now = new Date();
  const order: OrderDocument = { id: `FC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, userId, date: new Intl.DateTimeFormat("en-IN", { month: "long", day: "numeric", year: "numeric" }).format(now), items: cart.items, ...totals, status: "Processing", address, ...(totals.discount ? { discountCode: discount!.code } : {}), createdAt: now, updatedAt: now };
  const reserved: CartItem[] = [];
  for (const item of cart.items) {
    const result = await db.products.updateOne({ id: item.productId, stockQuantity: { $gte: item.quantity } }, { $inc: { stockQuantity: -item.quantity }, $set: { updatedAt: now } });
    if (!result.modifiedCount) {
      await Promise.all(reserved.map((line) => db.products.updateOne({ id: line.productId }, { $inc: { stockQuantity: line.quantity }, $set: { updatedAt: now } })));
      return { error: "Inventory changed while placing your order. Please review your cart." } as const;
    }
    reserved.push(item);
  }
  await db.orders.insertOne(order);
  await db.carts.updateOne({ userId }, { $set: { items: [], updatedAt: now } });
  logInfo("order.created", { orderId: order.id, userId, total: order.total });
  return { order: publicOrder(order) } as const;
}

export async function getOrderForUser(userId: string, orderId: string) {
  await ensureDatabase();
  return (await collections()).orders.findOne({ userId, id: orderId });
}

export async function getAdminData() {
  await ensureDatabase();
  const db = await collections();
  const [products, categories, discounts, users, orders] = await Promise.all([
    db.products.find().sort({ name: 1 }).toArray(), db.categories.find().sort({ name: 1 }).toArray(), db.discounts.find().sort({ code: 1 }).toArray(), db.users.find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).toArray(), db.orders.find().sort({ createdAt: -1 }).limit(100).toArray(),
  ]);
  return { products, categories, discounts, users, orders };
}

export async function adminUpsertProduct(product: Omit<ProductDocument, "createdAt" | "updatedAt" | "inStock">) {
  await ensureDatabase();
  const now = new Date();
  await (await collections()).products.updateOne({ id: product.id }, { $set: { ...product, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true });
}
export async function adminSetStock(productId: string, stockQuantity: number) { await ensureDatabase(); await (await collections()).products.updateOne({ id: productId }, { $set: { stockQuantity, updatedAt: new Date() } }); }
export async function adminUpsertCategory(category: Omit<CategoryDocument, "createdAt" | "updatedAt">) { await ensureDatabase(); const now = new Date(); await (await collections()).categories.updateOne({ id: category.id }, { $set: { ...category, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); }
export async function adminUpsertDiscount(discount: Omit<DiscountDocument, "createdAt" | "updatedAt">) { await ensureDatabase(); const now = new Date(); await (await collections()).discounts.updateOne({ code: discount.code }, { $set: { ...discount, updatedAt: now }, $setOnInsert: { createdAt: now } }, { upsert: true }); }
export async function adminUpdateOrderStatus(orderId: string, status: OrderStatus) { await ensureDatabase(); await (await collections()).orders.updateOne({ id: orderId }, { $set: { status, updatedAt: new Date() } }); }
export async function adminUpdateUserRole(userId: string, role: UserRole) { await ensureDatabase(); await (await collections()).users.updateOne({ id: userId }, { $set: { role } }); }
