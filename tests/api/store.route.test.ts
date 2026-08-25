import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ session: null as { user: { id: string; email: string } } | null }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => authState.session) }));

import { GET, POST } from "@/app/api/store/route";
import { closeApiState, createTestUser, getDb, resetApiState } from "../support/api-test";
import { configureTestEnvironment } from "../support/test-environment";

const storeRequest = (body: unknown) => POST(new Request("http://test/api/store", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
}));

describe("/api/store", () => {
  beforeAll(configureTestEnvironment);
  beforeEach(async () => {
    await resetApiState();
    authState.session = null;
  });
  afterAll(closeApiState);

  it("requires authentication for reads and mutations", async () => {
    expect((await GET()).status).toBe(401);
    expect((await storeRequest({ action: "cart:add", productId: "anything" })).status).toBe(401);
  });

  it("adds an item, creates an order, decrements stock, and clears the cart", async () => {
    const user = await createTestUser();
    authState.session = { user: { id: user.id, email: user.email } };
    const product = await (await getDb()).collection("products").findOne({ active: true, stockQuantity: { $gt: 0 } });
    if (!product) throw new Error("Expected seeded product.");
    expect((await storeRequest({ action: "cart:add", productId: product.id })).status).toBe(200);
    const response = await storeRequest({ action: "order:create", address: "12 MG Road, Bengaluru 560001" });
    expect(response.status).toBe(200);
    const state = await response.json();
    expect(state.cart).toEqual([]);
    expect(state.orders[0]).toMatchObject({ status: "Processing", total: product.price + (product.price >= 999 ? 0 : 49) });
    const updated = await (await getDb()).collection("products").findOne({ id: product.id });
    expect(updated?.stockQuantity).toBe(product.stockQuantity - 1);
  });

  it("returns 400 for malformed JSON, 422 for invalid actions, and 409 for unavailable products", async () => {
    const user = await createTestUser();
    authState.session = { user: { id: user.id, email: user.email } };
    expect((await POST(new Request("http://test/api/store", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await storeRequest({ action: "cart:update", productId: "x", quantity: -1 })).status).toBe(422);
    expect((await storeRequest({ action: "cart:add", productId: "missing-product" })).status).toBe(409);
  });
});
