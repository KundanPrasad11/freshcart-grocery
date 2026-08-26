import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  session: null as { user: { id: string; email: string } } | null,
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => authState.session) }));

import { GET, POST } from "@/app/api/store/route";
import { adminUpdateOrderFulfillment } from "@/lib/store-repository";
import { closeApiState, createTestUser, getDb, resetApiState } from "../support/api-test";
import { configureTestEnvironment } from "../support/test-environment";

const storeRequest = (body: unknown) =>
  POST(
    new Request("http://test/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("/api/store", () => {
  beforeAll(configureTestEnvironment);
  beforeEach(async () => {
    await resetApiState();
    authState.session = null;
  });
  afterAll(closeApiState);

  it("requires authentication for reads and mutations", async () => {
    expect((await GET(new Request("http://test/api/store"))).status).toBe(401);
    expect((await storeRequest({ action: "cart:add", productId: "anything" })).status).toBe(401);
  });

  it("creates an idempotent pending-payment reservation and clears the cart", async () => {
    const user = await createTestUser();
    authState.session = { user: { id: user.id, email: user.email } };
    const product = await (
      await getDb()
    )
      .collection("products")
      .findOne({ active: true, stockQuantity: { $gt: 0 } });
    if (!product) throw new Error("Expected seeded product.");
    expect((await storeRequest({ action: "cart:add", productId: product.id })).status).toBe(200);
    const slot = (await (await getDb()).collection("delivery_slots").find({ startsAt: { $gt: new Date() } }).sort({ startsAt: 1 }).limit(1).toArray())[0];
    if (!slot) throw new Error("Expected seeded delivery slot.");
    const response = await storeRequest({
      action: "order:create",
      address: "12 MG Road, Bengaluru 560001",
      delivery: { slotId: slot.id, instructions: "Leave with reception" },
      idempotencyKey: crypto.randomUUID(),
    });
    expect(response.status).toBe(200);
    const state = await response.json();
    expect(state.cart).toEqual([]);
    expect(state.orders[0]).toMatchObject({
      status: "Processing",
      total: product.price + (product.price >= 999 ? 0 : 49),
    });
    const updated = await (await getDb()).collection("products").findOne({ id: product.id });
    expect(updated?.stockQuantity).toBe(product.stockQuantity);
    expect(updated?.reservedQuantity).toBe(1);
    expect(state.orders[0]).toMatchObject({
      fulfillmentStatus: "awaiting_payment",
      payment: { provider: "stripe", status: "pending" },
      reservation: { status: "active" },
      delivery: { address: "12 MG Road, Bengaluru 560001", slot: { id: slot.id } },
    });
  });

  it("returns the same order for a retried idempotency key", async () => {
    const user = await createTestUser();
    authState.session = { user: { id: user.id, email: user.email } };
    const product = await (await getDb()).collection("products").findOne({ active: true, stockQuantity: { $gt: 0 } });
    const slot = await (await getDb()).collection("delivery_slots").findOne({ startsAt: { $gt: new Date() } });
    if (!product || !slot) throw new Error("Expected seeded checkout data.");
    await storeRequest({ action: "cart:add", productId: product.id });
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      action: "order:create",
      address: "12 MG Road, Bengaluru 560001",
      delivery: { slotId: slot.id },
      idempotencyKey,
    };
    const first = await storeRequest(payload);
    const second = await storeRequest(payload);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await (await getDb()).collection("orders").countDocuments({ userId: user.id })).toBe(1);
  });

  it("does not offer inventory already held by another pending checkout", async () => {
    const firstUser = await createTestUser();
    const secondUser = await createTestUser();
    const product = await (await getDb()).collection("products").findOne({ active: true, stockQuantity: { $gt: 0 } });
    const slot = await (await getDb()).collection("delivery_slots").findOne({ startsAt: { $gt: new Date() } });
    if (!product || !slot) throw new Error("Expected seeded checkout data.");
    await (await getDb()).collection("products").updateOne({ id: product.id }, { $set: { stockQuantity: 1, reservedQuantity: 0 } });
    authState.session = { user: { id: firstUser.id, email: firstUser.email } };
    await storeRequest({ action: "cart:add", productId: product.id });
    expect(
      (
        await storeRequest({
          action: "order:create",
          address: "12 MG Road, Bengaluru 560001",
          delivery: { slotId: slot.id },
          idempotencyKey: crypto.randomUUID(),
        })
      ).status
    ).toBe(200);
    authState.session = { user: { id: secondUser.id, email: secondUser.email } };
    expect((await storeRequest({ action: "cart:add", productId: product.id })).status).toBe(409);
  });

  it("releases inventory and delivery capacity when a pending order is cancelled", async () => {
    const user = await createTestUser();
    authState.session = { user: { id: user.id, email: user.email } };
    const product = await (await getDb()).collection("products").findOne({ active: true, stockQuantity: { $gt: 0 } });
    const slot = await (await getDb()).collection("delivery_slots").findOne({ startsAt: { $gt: new Date() } });
    if (!product || !slot) throw new Error("Expected seeded checkout data.");
    await storeRequest({ action: "cart:add", productId: product.id });
    const created = await storeRequest({
      action: "order:create",
      address: "12 MG Road, Bengaluru 560001",
      delivery: { slotId: slot.id },
      idempotencyKey: crypto.randomUUID(),
    });
    const orderId = (await created.json()).orders[0].id;
    const cancelled = await storeRequest({ action: "order:cancel", orderId, reason: "Changed my mind" });
    expect(cancelled.status).toBe(200);
    const [updatedProduct, updatedSlot, order] = await Promise.all([
      (await getDb()).collection("products").findOne({ id: product.id }),
      (await getDb()).collection("delivery_slots").findOne({ id: slot.id }),
      (await getDb()).collection("orders").findOne({ id: orderId }),
    ]);
    expect(updatedProduct?.reservedQuantity ?? 0).toBe(0);
    expect(updatedSlot?.reservedCount ?? 0).toBe(0);
    expect(order).toMatchObject({ status: "Cancelled", reservation: { status: "released" } });
    const reordered = await storeRequest({ action: "order:reorder", orderId });
    expect(reordered.status).toBe(200);
    await expect(reordered.json()).resolves.toMatchObject({
      unavailable: [],
      state: { cart: [{ productId: product.id, quantity: 1 }] },
    });
  });

  it("rejects invalid fulfillment jumps at the repository boundary", async () => {
    const user = await createTestUser();
    authState.session = { user: { id: user.id, email: user.email } };
    const product = await (await getDb()).collection("products").findOne({ active: true, stockQuantity: { $gt: 0 } });
    const slot = await (await getDb()).collection("delivery_slots").findOne({ startsAt: { $gt: new Date() } });
    if (!product || !slot) throw new Error("Expected seeded checkout data.");
    await storeRequest({ action: "cart:add", productId: product.id });
    const created = await storeRequest({
      action: "order:create",
      address: "12 MG Road, Bengaluru 560001",
      delivery: { slotId: slot.id },
      idempotencyKey: crypto.randomUUID(),
    });
    const orderId = (await created.json()).orders[0].id;
    await expect(adminUpdateOrderFulfillment(orderId, "delivered", "admin-1")).resolves.toMatchObject({
      error: expect.stringContaining("Cannot move"),
    });
  });

  it("returns 400 for malformed JSON, 422 for invalid actions, and 409 for unavailable products", async () => {
    const user = await createTestUser();
    authState.session = { user: { id: user.id, email: user.email } };
    expect(
      (
        await POST(
          new Request("http://test/api/store", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
          })
        )
      ).status
    ).toBe(400);
    expect(
      (await storeRequest({ action: "cart:update", productId: "x", quantity: -1 })).status
    ).toBe(422);
    expect((await storeRequest({ action: "cart:add", productId: "missing-product" })).status).toBe(
      409
    );
  });

  it("rejects a non-JSON content type", async () => {
    const user = await createTestUser();
    authState.session = { user: { id: user.id, email: user.email } };
    const response = await POST(
      new Request("http://test/api/store", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      })
    );
    expect(response.status).toBe(415);
  });
});
