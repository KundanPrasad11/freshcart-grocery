import crypto from "crypto";
import { ClientSession } from "mongodb";
import seedProducts from "@/data/products.json";
import { getDb, getMongoClient } from "@/lib/db";
import { logInfo } from "@/lib/logger";
import {
  CartDocument,
  CategoryDocument,
  DeliverySlot,
  DeliverySlotDocument,
  DiscountDocument,
  FulfillmentStatus,
  OrderDocument,
  OrderLineSnapshot,
  OrderStatus,
  ProcessedWebhookDocument,
  ProductDocument,
  StatusHistoryEntry,
  UserDocument,
  UserRole,
  WishlistDocument,
} from "@/lib/models";
import { CartItem, Category, Product } from "@/lib/catalog";
import {
  calculateOrderTotals,
  canTransitionFulfillment,
  isCustomerCancellable,
  legacyOrderStatus,
} from "@/lib/order-rules";

const DELIVERY_TIMEZONE = "Asia/Kolkata";
const DELIVERY_SLOT_CAPACITY = 20;
const RESERVATION_MINUTES = 15;

export type StoreState = {
  cart: CartItem[];
  wishlist: string[];
  orders: PublicOrder[];
  deliverySlots: DeliverySlot[];
};
export type PublicOrder = Pick<
  OrderDocument,
  | "id"
  | "date"
  | "items"
  | "lines"
  | "lineItems"
  | "total"
  | "status"
  | "address"
  | "delivery"
  | "payment"
  | "fulfillmentStatus"
  | "statusHistory"
  | "reservation"
>;

const categorySeed: Omit<CategoryDocument, "createdAt" | "updatedAt">[] = [
  {
    id: "fresh-produce",
    name: "Fresh Produce",
    emoji: "🥬",
    description: "Fruit & vegetables",
    active: true,
  },
  {
    id: "dairy-eggs",
    name: "Dairy & Eggs",
    emoji: "🥛",
    description: "Farm-fresh staples",
    active: true,
  },
  { id: "bakery", name: "Bakery", emoji: "🥖", description: "Baked this morning", active: true },
  { id: "pantry", name: "Pantry", emoji: "🫙", description: "Kitchen essentials", active: true },
  {
    id: "meat-seafood",
    name: "Meat & Seafood",
    emoji: "🐟",
    description: "Responsibly sourced",
    active: true,
  },
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
    deliverySlots: db.collection<DeliverySlotDocument>("delivery_slots"),
    processedWebhooks: db.collection<ProcessedWebhookDocument>("processed_webhooks"),
  };
}

function indiaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DELIVERY_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function seededDeliverySlots(now: Date) {
  const { year, month, day } = indiaDateParts(now);
  const indianMidnight = Date.UTC(year, month - 1, day);
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    timeZone: DELIVERY_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return Array.from({ length: 8 }, (_, offset) => {
    const date = new Date(indianMidnight + offset * 24 * 60 * 60 * 1000);
    const parts = indiaDateParts(date);
    const idDate = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    const windows = [
      { key: "morning", startHourUtc: 4.5, endHourUtc: 7.5, time: "10 AM – 1 PM" },
      { key: "afternoon", startHourUtc: 9.5, endHourUtc: 12.5, time: "3 PM – 6 PM" },
    ];
    return windows.map((window) => {
      const startsAt = new Date(indianMidnight + offset * 86_400_000 + window.startHourUtc * 3_600_000);
      const endsAt = new Date(indianMidnight + offset * 86_400_000 + window.endHourUtc * 3_600_000);
      return {
        id: `delivery-${idDate}-${window.key}`,
        label: `${dateLabel.format(startsAt)} · ${window.time}`,
        startsAt,
        endsAt,
        timezone: DELIVERY_TIMEZONE,
        capacity: DELIVERY_SLOT_CAPACITY,
        reservedCount: 0,
        createdAt: now,
        updatedAt: now,
      } satisfies DeliverySlotDocument;
    });
  }).flat();
}

async function ensureDeliverySlots() {
  const db = await collections();
  const now = new Date();
  const slots = seededDeliverySlots(now);
  await db.deliverySlots.bulkWrite(
    slots.map((slot) => ({
      updateOne: { filter: { id: slot.id }, update: { $setOnInsert: slot }, upsert: true },
    }))
  );
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
        db.orders.createIndex(
          { userId: 1, idempotencyKey: 1 },
          { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
        ),
        db.orders.createIndex(
          { "payment.checkoutSessionId": 1 },
          { unique: true, partialFilterExpression: { "payment.checkoutSessionId": { $type: "string" } } }
        ),
        db.orders.createIndex(
          { "payment.paymentIntentId": 1 },
          { unique: true, partialFilterExpression: { "payment.paymentIntentId": { $type: "string" } } }
        ),
        db.deliverySlots.createIndex({ id: 1 }, { unique: true }),
        db.deliverySlots.createIndex({ startsAt: 1 }),
        db.processedWebhooks.createIndex({ eventId: 1 }, { unique: true }),
      ]);
      if ((await db.products.countDocuments()) === 0) {
        const now = new Date();
        await db.products.insertMany(
          seedProducts.map((product) => ({
            ...product,
            stockQuantity: product.inStock ? 30 : 0,
            reservedQuantity: 0,
            active: true,
            createdAt: now,
            updatedAt: now,
          }))
        );
        await db.categories.insertMany(
          categorySeed.map((category) => ({ ...category, createdAt: now, updatedAt: now }))
        );
        logInfo("database.catalog_seeded", { products: seedProducts.length });
      }
      // Targeted data repair for an upstream image that was removed by Unsplash.
      await db.products.updateOne(
        { id: "tomato", image: "https://images.unsplash.com/photo-1546470427-227c7360f3d8?auto=format&fit=crop&w=900&q=80" },
        { $set: { image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=900&q=80", updatedAt: new Date() } }
      );
      await ensureDeliverySlots();
    })();
  }
  return initialized;
}

const publicProduct = (product: ProductDocument): Product => {
  const { stockQuantity, reservedQuantity = 0, active, createdAt, updatedAt, ...publicFields } = product;
  return { ...publicFields, inStock: active && stockQuantity - reservedQuantity > 0 };
};
const publicOrder = (order: OrderDocument): PublicOrder => ({
  id: order.id,
  date: order.date,
  items: order.items,
  lines: order.lines,
  lineItems: order.lineItems,
  total: order.total,
  status: order.status,
  address: order.address,
  delivery: typeof order.delivery === "object" ? order.delivery : undefined,
  payment: order.payment,
  fulfillmentStatus: order.fulfillmentStatus,
  statusHistory: order.statusHistory,
  reservation: order.reservation,
});

function availableQuantity(product: ProductDocument) {
  return Math.max(0, product.stockQuantity - (product.reservedQuantity ?? 0));
}

async function availableDeliverySlots() {
  await ensureDatabase();
  const now = new Date();
  const db = await collections();
  return db.deliverySlots
    .find({ startsAt: { $gt: now }, $expr: { $lt: [{ $ifNull: ["$reservedCount", 0] }, "$capacity"] } })
    .sort({ startsAt: 1 })
    .toArray();
}

export async function getCatalog() {
  await ensureDatabase();
  const db = await collections();
  const [products, categoryDocs] = await Promise.all([
    db.products.find({ active: true }).sort({ featured: -1, name: 1 }).toArray(),
    db.categories.find({ active: true }).sort({ name: 1 }).toArray(),
  ]);
  return {
    products: products.map(publicProduct),
    categories: categoryDocs.map(
      ({ id, name, emoji, description }) => ({ id, name, emoji, description }) satisfies Category
    ),
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
    id: crypto.randomUUID(),
    name,
    email: normalizedEmail,
    passwordHash,
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

function legacyFulfillmentStatus(status: OrderStatus): FulfillmentStatus {
  if (status === "Packed") return "packed";
  if (status === "Out for delivery") return "out_for_delivery";
  if (status === "Delivered") return "delivered";
  if (status === "Cancelled") return "cancelled";
  return "processing";
}

function orderLines(order: OrderDocument): OrderLineSnapshot[] {
  if (order.lines?.length) return order.lines;
  if (order.lineItems?.length) return order.lineItems;
  return order.items.map((item) => ({
    productId: item.productId,
    name: item.productId,
    unit: "item",
    unitPrice: 0,
    quantity: item.quantity,
    lineTotal: 0,
  }));
}

function history(from: string | null, to: string, actor: string, at: Date, reason?: string): StatusHistoryEntry {
  return { from, to, actor, at, ...(reason ? { reason } : {}) };
}

async function releaseReservationInSession(
  order: OrderDocument,
  session: ClientSession,
  status: "released" | "expired",
  actor: string,
  reason: string
) {
  const db = await collections();
  const now = new Date();
  const claimed = await db.orders.updateOne(
    { id: order.id, "reservation.status": "active" },
    {
      $set: {
        status: "Cancelled",
        fulfillmentStatus: "cancelled",
        reservation: { status },
        payment: { ...(order.payment ?? { provider: "stripe", status: "pending" as const }), status: "failed" },
        updatedAt: now,
      },
      $push: {
        statusHistory: history(order.fulfillmentStatus ?? legacyFulfillmentStatus(order.status), "cancelled", actor, now, reason),
      },
    },
    { session }
  );
  if (!claimed.modifiedCount) return false;
  await Promise.all(
    orderLines(order).map((line) =>
      db.products.updateOne(
        { id: line.productId },
        { $inc: { reservedQuantity: -line.quantity }, $set: { updatedAt: now } },
        { session }
      )
    )
  );
  const delivery = typeof order.delivery === "object" ? order.delivery : undefined;
  if (delivery?.slot.id)
    await db.deliverySlots.updateOne(
      { id: delivery.slot.id },
      { $inc: { reservedCount: -1 }, $set: { updatedAt: now } },
      { session }
    );
  return true;
}

/** Expiration is deliberately lazy for now: every store read/write clears expired holds. */
export async function releaseExpiredReservations() {
  await ensureDatabase();
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const db = await collections();
      const expired = await db.orders
        .find({
          "reservation.status": "active",
          "reservation.expiresAt": { $lte: new Date() },
          "payment.status": "pending",
        })
        .toArray();
      for (const order of expired)
        await releaseReservationInSession(order, session, "expired", "system", "Payment window expired");
    });
  } finally {
    await session.endSession();
  }
}

export async function getState(userId: string): Promise<StoreState> {
  await ensureDatabase();
  await releaseExpiredReservations();
  const db = await collections();
  const [cart, wishlist, orders, deliverySlots] = await Promise.all([
    db.carts.findOne({ userId }),
    db.wishlists.findOne({ userId }),
    db.orders.find({ userId }).sort({ createdAt: -1 }).toArray(),
    availableDeliverySlots(),
  ]);
  return {
    cart: cart?.items ?? [],
    wishlist: wishlist?.productIds ?? [],
    orders: orders.map(publicOrder),
    deliverySlots: deliverySlots.map(({ id, label, startsAt, endsAt, timezone }) => ({ id, label, startsAt, endsAt, timezone })),
  };
}

async function canAddCartQuantity(productId: string, quantity: number) {
  await ensureDatabase();
  await releaseExpiredReservations();
  const product = await (await collections()).products.findOne({ id: productId, active: true });
  return Boolean(product && availableQuantity(product) >= quantity);
}

export async function addToCart(userId: string, productId: string) {
  await ensureDatabase();
  const db = await collections();
  const cart = await db.carts.findOne({ userId });
  const current = cart?.items.find((item) => item.productId === productId)?.quantity ?? 0;
  if (!(await canAddCartQuantity(productId, current + 1))) return null;
  const now = new Date();
  const updated = await db.carts.updateOne(
    { userId, "items.productId": productId },
    { $inc: { "items.$.quantity": 1 }, $set: { updatedAt: now } }
  );
  if (!updated.matchedCount)
    await db.carts.updateOne(
      { userId },
      { $push: { items: { productId, quantity: 1 } }, $set: { updatedAt: now } },
      { upsert: true }
    );
  return getState(userId);
}

export async function updateCart(userId: string, productId: string, quantity: number) {
  await ensureDatabase();
  const db = await collections();
  if (quantity < 1) {
    await db.carts.updateOne(
      { userId },
      { $pull: { items: { productId } }, $set: { updatedAt: new Date() } }
    );
  } else {
    if (!(await canAddCartQuantity(productId, quantity))) return null;
    const now = new Date();
    const updated = await db.carts.updateOne(
      { userId, "items.productId": productId },
      { $set: { "items.$.quantity": quantity, updatedAt: now } }
    );
    if (!updated.matchedCount)
      await db.carts.updateOne(
        { userId },
        { $push: { items: { productId, quantity } }, $set: { updatedAt: now } },
        { upsert: true }
      );
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
  const next = productIds.includes(productId)
    ? productIds.filter((id) => id !== productId)
    : [...productIds];
  if (!productIds.includes(productId)) next.push(productId);
  await db.wishlists.updateOne(
    { userId },
    { $set: { productIds: next, updatedAt: new Date() } },
    { upsert: true }
  );
  return getState(userId);
}

class CheckoutRejected extends Error {}

export type CreateOrderInput = {
  address: string;
  instructions?: string;
  slotId: string;
  idempotencyKey: string;
  discountCode?: string;
};

export async function createOrder(userId: string, input: CreateOrderInput) {
  await ensureDatabase();
  await releaseExpiredReservations();
  const client = await getMongoClient();
  const session = client.startSession();
  let result: { order: PublicOrder } | { error: string } | undefined;
  try {
    await session.withTransaction(async () => {
      const db = await collections();
      const existing = await db.orders.findOne({ userId, idempotencyKey: input.idempotencyKey }, { session });
      if (existing) { result = { order: publicOrder(existing) }; return; }
      const now = new Date();
      const cart = await db.carts.findOne({ userId }, { session });
      if (!cart?.items.length) throw new CheckoutRejected("Your cart is empty.");
      const productIds = cart.items.map((item) => item.productId);
      const products = await db.products.find({ id: { $in: productIds }, active: true }, { session }).toArray();
      if (products.length !== productIds.length) throw new CheckoutRejected("One or more products are no longer available.");
      const byId = new Map(products.map((product) => [product.id, product]));
      if (cart.items.some((item) => availableQuantity(byId.get(item.productId)!) < item.quantity))
        throw new CheckoutRejected("One or more products no longer have enough stock.");
      const slot = await db.deliverySlots.findOne(
        { id: input.slotId, startsAt: { $gt: now }, $expr: { $lt: [{ $ifNull: ["$reservedCount", 0] }, "$capacity"] } },
        { session }
      );
      if (!slot) throw new CheckoutRejected("That delivery slot is no longer available. Please choose another.");
      const discount = input.discountCode
        ? await db.discounts.findOne({ code: input.discountCode.toUpperCase(), active: true }, { session })
        : null;
      const totals = calculateOrderTotals(
        cart.items.map((item) => ({ price: byId.get(item.productId)!.price, quantity: item.quantity })), discount
      );
      const lines: OrderLineSnapshot[] = cart.items.map((item) => {
        const product = byId.get(item.productId)!;
        return { productId: product.id, name: product.name, unit: product.unit, unitPrice: product.price, quantity: item.quantity, lineTotal: product.price * item.quantity };
      });
      for (const line of lines) {
        const reserved = await db.products.updateOne(
          { id: line.productId, active: true, $expr: { $gte: [{ $subtract: ["$stockQuantity", { $ifNull: ["$reservedQuantity", 0] }] }, line.quantity] } },
          { $inc: { reservedQuantity: line.quantity }, $set: { updatedAt: now } },
          { session }
        );
        if (!reserved.modifiedCount) throw new CheckoutRejected("Inventory changed while placing your order. Please review your cart.");
      }
      const reservedSlot = await db.deliverySlots.updateOne(
        { id: slot.id, startsAt: { $gt: now }, $expr: { $lt: [{ $ifNull: ["$reservedCount", 0] }, "$capacity"] } },
        { $inc: { reservedCount: 1 }, $set: { updatedAt: now } },
        { session }
      );
      if (!reservedSlot.modifiedCount) throw new CheckoutRejected("That delivery slot was just taken. Please choose another.");
      const delivery: OrderDocument["delivery"] = {
        address: input.address,
        ...(input.instructions ? { instructions: input.instructions } : {}),
        slot: { id: slot.id, label: slot.label, startsAt: slot.startsAt, endsAt: slot.endsAt, timezone: slot.timezone },
      };
      const fulfillmentStatus: FulfillmentStatus = "awaiting_payment";
      const order: OrderDocument = {
        id: `FC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        userId,
        date: new Intl.DateTimeFormat("en-IN", { month: "long", day: "numeric", year: "numeric" }).format(now),
        items: cart.items,
        lines,
        lineItems: lines,
        ...totals,
        status: legacyOrderStatus(fulfillmentStatus),
        address: input.address,
        delivery,
        payment: { provider: "stripe", status: "pending" },
        fulfillmentStatus,
        statusHistory: [history(null, fulfillmentStatus, `customer:${userId}`, now)],
        idempotencyKey: input.idempotencyKey,
        reservation: { status: "active", expiresAt: new Date(now.getTime() + RESERVATION_MINUTES * 60_000) },
        ...(totals.discount ? { discountCode: discount!.code } : {}),
        createdAt: now,
        updatedAt: now,
      };
      await db.orders.insertOne(order, { session });
      await db.carts.updateOne({ userId }, { $set: { items: [], updatedAt: now } }, { session });
      result = { order: publicOrder(order) };
      logInfo("order.reserved", { orderId: order.id, userId, total: order.total });
    });
  } catch (error) {
    if (error instanceof CheckoutRejected) return { error: error.message } as const;
    if (typeof error === "object" && error && "code" in error && error.code === 11000) {
      const existing = await (await collections()).orders.findOne({ userId, idempotencyKey: input.idempotencyKey });
      if (existing) return { order: publicOrder(existing) } as const;
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return result ?? ({ error: "Unable to reserve this order." } as const);
}

export async function cancelOrder(userId: string, orderId: string, reason?: string) {
  await ensureDatabase();
  const db = await collections();
  const order = await db.orders.findOne({ userId, id: orderId });
  if (!order) return { error: "Order not found." } as const;
  const fulfillmentStatus = order.fulfillmentStatus ?? legacyFulfillmentStatus(order.status);
  if (!isCustomerCancellable(fulfillmentStatus)) return { error: "Orders can only be cancelled before they are packed." } as const;
  if (order.payment?.status === "paid" || order.payment?.status === "refund_pending") {
    const now = new Date();
    await db.orders.updateOne(
      { id: orderId, userId, "payment.status": { $in: ["paid", "refund_pending"] } },
      { $set: { "payment.status": "refund_pending", updatedAt: now }, $push: { statusHistory: history(`payment:${order.payment.status}`, "payment:refund_pending", `customer:${userId}`, now, reason ?? "Customer requested cancellation") } }
    );
    return { refundPending: true } as const;
  }
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    let cancelled = false;
    await session.withTransaction(async () => {
      const current = await (await collections()).orders.findOne({ id: orderId, userId }, { session });
      if (!current) throw new CheckoutRejected("Order not found.");
      cancelled = await releaseReservationInSession(current, session, "released", `customer:${userId}`, reason ?? "Customer cancelled before packing");
    });
    return cancelled ? ({ cancelled: true } as const) : ({ error: "This order can no longer be cancelled." } as const);
  } finally {
    await session.endSession();
  }
}

/** Stripe webhook seam: a failed or expired payment releases an active hold. */
export async function releaseReservationAfterPaymentFailure(orderId: string, reason = "Payment failed") {
  await ensureDatabase();
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    let released = false;
    await session.withTransaction(async () => {
      const order = await (await collections()).orders.findOne(
        { id: orderId, "payment.status": "pending", "reservation.status": "active" },
        { session }
      );
      if (order) released = await releaseReservationInSession(order, session, "released", "stripe:webhook", reason);
    });
    return released;
  } finally {
    await session.endSession();
  }
}

/** Stripe webhook seam: convert a held checkout into a paid fulfillment order exactly once. */
export async function markOrderPaid(
  orderId: string,
  payment: Pick<NonNullable<OrderDocument["payment"]>, "checkoutSessionId" | "paymentIntentId">
) {
  await ensureDatabase();
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    let paid = false;
    await session.withTransaction(async () => {
      const db = await collections();
      const order = await db.orders.findOne(
        { id: orderId, "payment.status": "pending", "reservation.status": "active" },
        { session }
      );
      if (!order) return;
      const now = new Date();
      for (const line of orderLines(order)) {
        const consumed = await db.products.updateOne(
          { id: line.productId, stockQuantity: { $gte: line.quantity }, reservedQuantity: { $gte: line.quantity } },
          { $inc: { stockQuantity: -line.quantity, reservedQuantity: -line.quantity }, $set: { updatedAt: now } },
          { session }
        );
        if (!consumed.modifiedCount) throw new CheckoutRejected("Reserved inventory could not be consumed.");
      }
      const from = order.fulfillmentStatus ?? legacyFulfillmentStatus(order.status);
      await db.orders.updateOne(
        { id: orderId, "payment.status": "pending", "reservation.status": "active" },
        {
          $set: {
            payment: { provider: "stripe", status: "paid", ...payment },
            reservation: { status: "consumed" },
            fulfillmentStatus: "processing",
            status: "Processing",
            updatedAt: now,
          },
          $push: {
            statusHistory: {
              $each: [
                history("payment:pending", "payment:paid", "stripe:webhook", now),
                history(from, "processing", "stripe:webhook", now, "Payment confirmed"),
              ],
            },
          },
        },
        { session }
      );
      paid = true;
    });
    return paid;
  } finally {
    await session.endSession();
  }
}

/** Stripe webhook seam: only a confirmed refund finalizes cancellation and physical restock. */
export async function finalizeRefund(orderId: string, refundId: string) {
  await ensureDatabase();
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    let finalized = false;
    await session.withTransaction(async () => {
      const db = await collections();
      const order = await db.orders.findOne({ id: orderId, "payment.status": "refund_pending" }, { session });
      if (!order) return;
      const now = new Date();
      await Promise.all(
        orderLines(order).map((line) =>
          db.products.updateOne(
            { id: line.productId },
            { $inc: { stockQuantity: line.quantity }, $set: { updatedAt: now } },
            { session }
          )
        )
      );
      const delivery = typeof order.delivery === "object" ? order.delivery : undefined;
      if (delivery)
        await db.deliverySlots.updateOne(
          { id: delivery.slot.id },
          { $inc: { reservedCount: -1 }, $set: { updatedAt: now } },
          { session }
        );
      const from = order.fulfillmentStatus ?? legacyFulfillmentStatus(order.status);
      await db.orders.updateOne(
        { id: orderId, "payment.status": "refund_pending" },
        {
          $set: {
            payment: { ...(order.payment ?? { provider: "stripe", status: "pending" as const }), status: "refunded", refundId },
            fulfillmentStatus: "cancelled",
            status: "Cancelled",
            updatedAt: now,
          },
          $push: {
            statusHistory: {
              $each: [
                history("payment:refund_pending", "payment:refunded", "stripe:webhook", now),
                history(from, "cancelled", "stripe:webhook", now, "Refund confirmed"),
              ],
            },
          },
        },
        { session }
      );
      finalized = true;
    });
    return finalized;
  } finally {
    await session.endSession();
  }
}

export async function reorderOrder(userId: string, orderId: string) {
  await ensureDatabase();
  await releaseExpiredReservations();
  const db = await collections();
  const order = await db.orders.findOne({ id: orderId, userId });
  if (!order) return { error: "Order not found." } as const;
  const previousLines = orderLines(order);
  if (!previousLines.length) return { error: "This order has no items to reorder." } as const;
  const productIds = previousLines.map((line) => line.productId);
  const [products, cart] = await Promise.all([
    db.products.find({ id: { $in: productIds }, active: true }).toArray(),
    db.carts.findOne({ userId }),
  ]);
  const byId = new Map(products.map((product) => [product.id, product]));
  const next = [...(cart?.items ?? [])];
  const unavailable: string[] = [];
  for (const line of previousLines) {
    const product = byId.get(line.productId);
    const existing = next.find((item) => item.productId === line.productId);
    const wanted = (existing?.quantity ?? 0) + line.quantity;
    if (!product || availableQuantity(product) < wanted) {
      unavailable.push(line.name);
      continue;
    }
    if (existing) existing.quantity = wanted;
    else next.push({ productId: line.productId, quantity: line.quantity });
  }
  await db.carts.updateOne({ userId }, { $set: { items: next, updatedAt: new Date() } }, { upsert: true });
  return { state: await getState(userId), unavailable } as const;
}

export async function getOrderForUser(userId: string, orderId: string) {
  await ensureDatabase();
  return (await collections()).orders.findOne({ userId, id: orderId });
}

export async function getAdminData() {
  await ensureDatabase();
  const db = await collections();
  const [products, categories, discounts, users, orders, deliverySlots] = await Promise.all([
    db.products.find().sort({ name: 1 }).toArray(),
    db.categories.find().sort({ name: 1 }).toArray(),
    db.discounts.find().sort({ code: 1 }).toArray(),
    db.users.find({}, { projection: { passwordHash: 0 } }).sort({ createdAt: -1 }).toArray(),
    db.orders.find().sort({ createdAt: -1 }).limit(100).toArray(),
    db.deliverySlots.find({ startsAt: { $gt: new Date() } }).sort({ startsAt: 1 }).toArray(),
  ]);
  return {
    products,
    categories,
    discounts,
    users,
    // Legacy orders stored a numeric fee at `delivery`; never expose that as
    // the new delivery-details object to dashboard clients.
    orders: orders.map((order) => ({
      ...order,
      delivery: typeof order.delivery === "object" ? order.delivery : undefined,
      deliveryFee: order.deliveryFee ?? (typeof order.delivery === "number" ? order.delivery : 0),
    })),
    deliverySlots,
  };
}

export async function adminUpsertProduct(product: Omit<ProductDocument, "createdAt" | "updatedAt" | "inStock" | "reservedQuantity">) {
  await ensureDatabase();
  const now = new Date();
  await (await collections()).products.updateOne(
    { id: product.id },
    { $set: { ...product, updatedAt: now }, $setOnInsert: { createdAt: now, reservedQuantity: 0 } },
    { upsert: true }
  );
}
export async function adminSetStock(productId: string, stockQuantity: number) {
  await ensureDatabase();
  const db = await collections();
  const product = await db.products.findOne({ id: productId });
  if (!product) return { error: "Product not found." } as const;
  if (stockQuantity < (product.reservedQuantity ?? 0)) return { error: "Stock cannot be lower than the quantity reserved by pending checkouts." } as const;
  await db.products.updateOne({ id: productId }, { $set: { stockQuantity, updatedAt: new Date() } });
  return { ok: true } as const;
}
export async function adminUpsertCategory(category: Omit<CategoryDocument, "createdAt" | "updatedAt">) {
  await ensureDatabase();
  const now = new Date();
  await (await collections()).categories.updateOne(
    { id: category.id },
    { $set: { ...category, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}
export async function adminUpsertDiscount(discount: Omit<DiscountDocument, "createdAt" | "updatedAt">) {
  await ensureDatabase();
  const now = new Date();
  await (await collections()).discounts.updateOne(
    { code: discount.code },
    { $set: { ...discount, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
}

export async function adminUpdateOrderFulfillment(orderId: string, status: FulfillmentStatus, adminId: string, reason?: string) {
  await ensureDatabase();
  const db = await collections();
  const order = await db.orders.findOne({ id: orderId });
  if (!order) return { error: "Order not found." } as const;
  const from = order.fulfillmentStatus ?? legacyFulfillmentStatus(order.status);
  if (!canTransitionFulfillment(from, status)) return { error: `Cannot move an order from ${from.replaceAll("_", " ")} to ${status.replaceAll("_", " ")}.` } as const;
  if (from === "awaiting_payment" && status === "processing" && order.payment?.status !== "paid") return { error: "The order cannot enter fulfillment until payment succeeds." } as const;
  const now = new Date();
  await db.orders.updateOne(
    { id: orderId, fulfillmentStatus: order.fulfillmentStatus ?? { $exists: false } },
    { $set: { fulfillmentStatus: status, status: legacyOrderStatus(status), updatedAt: now }, $push: { statusHistory: history(from, status, `admin:${adminId}`, now, reason) } }
  );
  return { ok: true } as const;
}

/** Backward-compatible adapter for the pre-fulfillment admin form. */
export async function adminUpdateOrderStatus(orderId: string, status: OrderStatus, adminId: string) {
  const map: Record<OrderStatus, FulfillmentStatus> = {
    Processing: "processing", Packed: "packed", "Out for delivery": "out_for_delivery", Delivered: "delivered", Cancelled: "cancelled",
  };
  return adminUpdateOrderFulfillment(orderId, map[status], adminId);
}
export async function adminUpdateUserRole(userId: string, role: UserRole) {
  await ensureDatabase();
  await (await collections()).users.updateOne({ id: userId }, { $set: { role } });
}
