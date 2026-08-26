import { CartItem, Product } from "@/lib/catalog";

export type UserRole = "customer" | "admin";
export type UserDocument = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
};
export type CartDocument = { userId: string; items: CartItem[]; updatedAt: Date };
export type WishlistDocument = { userId: string; productIds: string[]; updatedAt: Date };
export type ProductDocument = Omit<Product, "inStock"> & {
  stockQuantity: number;
  /** Quantity held by unpaid checkout reservations. Older product documents omit this. */
  reservedQuantity?: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
export type CategoryDocument = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
export type DiscountDocument = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minimumOrder: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
export type OrderStatus = "Processing" | "Packed" | "Out for delivery" | "Delivered" | "Cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "refund_pending" | "refunded";
export type FulfillmentStatus =
  | "awaiting_payment"
  | "processing"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type ReservationStatus = "active" | "released" | "expired" | "consumed";
export type OrderLineSnapshot = {
  productId: string;
  name: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};
export type DeliverySlot = {
  id: string;
  label: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
};
export type DeliverySlotDocument = DeliverySlot & {
  capacity: number;
  reservedCount: number;
  createdAt: Date;
  updatedAt: Date;
};
export type OrderDelivery = {
  address: string;
  instructions?: string;
  slot: DeliverySlot;
};
export type OrderPayment = {
  provider: "stripe";
  status: PaymentStatus;
  checkoutSessionId?: string;
  paymentIntentId?: string;
  refundId?: string;
};
export type StatusHistoryEntry = {
  from: string | null;
  to: string;
  at: Date;
  actor: string;
  reason?: string;
};
export type OrderReservation = { status: ReservationStatus; expiresAt?: Date };
export type OrderDocument = {
  id: string;
  userId: string;
  date: string;
  items: CartItem[];
  /** New immutable snapshot name. `lineItems` remains while old orders are migrated. */
  lines?: OrderLineSnapshot[];
  lineItems?: OrderLineSnapshot[];
  subtotal: number;
  /**
   * Old orders stored the delivery fee at this key. New orders store delivery
   * details here and write the fee to `deliveryFee`; the union keeps readers
   * compatible until a deliberate backfill is run.
   */
  delivery?: OrderDelivery | number;
  deliveryFee?: number;
  discount: number;
  total: number;
  status: OrderStatus;
  address: string;
  payment?: OrderPayment;
  fulfillmentStatus?: FulfillmentStatus;
  statusHistory?: StatusHistoryEntry[];
  idempotencyKey?: string;
  reservation?: OrderReservation;
  discountCode?: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Reserved for Stripe's later webhook implementation. */
export type ProcessedWebhookDocument = { eventId: string; processedAt: Date };
