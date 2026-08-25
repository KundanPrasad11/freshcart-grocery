import { auth } from "@/auth";
import { addToCart, createOrder, getState, toggleWishlist, updateCart } from "@/lib/store-repository";
import { isResponse, readJson } from "@/lib/http";
import { logError } from "@/lib/logger";
import { storeActionSchema } from "@/lib/schemas";

async function emailForRequest() {
  return (await auth())?.user?.email?.toLowerCase() ?? null;
}
async function userIdForRequest() {
  return (await auth())?.user?.id ?? null;
}
export async function GET() {
  const userId = await userIdForRequest();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await getState(userId)); }
  catch (error) { logError("store.read_failed", error, { userId }); return Response.json({ error: "Store is temporarily unavailable." }, { status: 503 }); }
}
export async function POST(request: Request) {
  const userId = await userIdForRequest();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await readJson(request, storeActionSchema);
  if (isResponse(body)) return body;
  try {
    if (body.action === "cart:add") {
      const state = await addToCart(userId, body.productId);
      return state ? Response.json(state) : Response.json({ error: "That product is unavailable." }, { status: 409 });
    }
    if (body.action === "cart:update") {
      const state = await updateCart(userId, body.productId, body.quantity);
      return state ? Response.json(state) : Response.json({ error: "That product is unavailable." }, { status: 409 });
    }
    if (body.action === "wishlist:toggle") {
      const state = await toggleWishlist(userId, body.productId);
      return state ? Response.json(state) : Response.json({ error: "That product is unavailable." }, { status: 409 });
    }
    const result = await createOrder(userId, body.address, body.discountCode);
    if ("error" in result) return Response.json({ error: result.error }, { status: 409 });
    return Response.json(await getState(userId));
  } catch (error) {
    logError("store.action_failed", error, { userId, action: body.action });
    return Response.json({ error: "We could not complete that action. Please try again." }, { status: 503 });
  }
}
