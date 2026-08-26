import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  session: null as { user: { id: string; email: string } } | null,
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => authState.session) }));

import { POST } from "@/app/api/invoice/route";
import { addToCart, createOrder, getState } from "@/lib/store-repository";
import { closeApiState, createTestUser, getDb, resetApiState } from "../support/api-test";
import { configureTestEnvironment } from "../support/test-environment";

const invoiceRequest = (orderId: string) =>
  POST(
    new Request("http://test/api/invoice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId }),
    })
  );

async function createOrderForSignedInUser() {
  const user = await createTestUser();
  authState.session = { user: { id: user.id, email: user.email } };
  const product = await (
    await getDb()
  )
    .collection("products")
    .findOne({ active: true, stockQuantity: { $gt: 0 } });
  if (!product) throw new Error("Expected seeded product.");
  await addToCart(user.id, product.id);
  const slot = (await getState(user.id)).deliverySlots[0];
  if (!slot) throw new Error("Expected seeded delivery slot.");
  const result = await createOrder(user.id, {
    address: "12 MG Road, Bengaluru 560001",
    slotId: slot.id,
    idempotencyKey: crypto.randomUUID(),
  });
  if ("error" in result) throw new Error(result.error);
  return { order: result.order, product };
}

describe("POST /api/invoice", () => {
  beforeAll(() => {
    configureTestEnvironment();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.INVOICE_FROM = "FreshCart <onboarding@resend.dev>";
    delete process.env.INVOICE_TEST_RECIPIENT;
  });
  beforeEach(async () => {
    await resetApiState();
    authState.session = null;
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(closeApiState);

  it("requires a signed-in order owner", async () => {
    expect((await invoiceRequest("FC-1234ABCD")).status).toBe(401);
  });

  it("sends escaped invoice HTML and an attachment through Resend", async () => {
    const { order, product } = await createOrderForSignedInUser();
    await (
      await getDb()
    )
      .collection("orders")
      .updateOne({ id: order.id }, { $set: { "lineItems.0.name": "<script>alert('x')</script>" } });
    const send = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 })
    );
    vi.stubGlobal("fetch", send);

    const response = await invoiceRequest(order.id);
    expect(response.status).toBe(200);
    const options = send.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(String(options.body));
    expect(payload.to).toEqual([authState.session?.user.email]);
    expect(payload.attachments[0].filename).toBe(`${order.id}-invoice.pdf`);
    expect(payload.html).toContain("&lt;script&gt;");
    expect(payload.html).not.toContain("<script>");
  });

  it("maps Resend recipient restrictions to a useful error", async () => {
    const { order } = await createOrderForSignedInUser();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("forbidden", { status: 403 }))
    );
    const response = await invoiceRequest(order.id);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Resend blocked"),
    });
  });

  it("returns a safe error when Resend times out", async () => {
    const { order } = await createOrderForSignedInUser();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new DOMException("Timed out", "AbortError");
      })
    );
    const response = await invoiceRequest(order.id);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ code: "INVOICE_UNAVAILABLE" });
  });
});
