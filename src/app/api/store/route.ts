import { auth } from "@/auth";
import {
  addToCart,
  cancelOrder,
  createOrder,
  getState,
  reorderOrder,
  toggleWishlist,
  updateCart,
} from "@/lib/store-repository";
import { apiError, isResponse, readJson } from "@/lib/http";
import { createRequestContext, logRequestError } from "@/lib/logger";
import { storeActionSchema } from "@/lib/schemas";

async function userIdForRequest() {
  return (await auth())?.user?.id ?? null;
}
export async function GET(request: Request) {
  const requestContext = createRequestContext(request);
  try {
    const userId = await userIdForRequest();
    if (!userId) return apiError(requestContext, 401, "UNAUTHORIZED", "Unauthorized");
    return Response.json(await getState(userId), {
      headers: { "x-request-id": requestContext.requestId },
    });
  } catch (error) {
    logRequestError("store.read_failed", error, requestContext);
    return apiError(requestContext, 503, "STORE_UNAVAILABLE", "Store is temporarily unavailable.");
  }
}
export async function POST(request: Request) {
  const requestContext = createRequestContext(request);
  try {
    const userId = await userIdForRequest();
    if (!userId) return apiError(requestContext, 401, "UNAUTHORIZED", "Unauthorized");
    const body = await readJson(request, storeActionSchema, { maxBytes: 4 * 1024, requestContext });
    if (isResponse(body)) return body;
    if (body.action === "cart:add") {
      const state = await addToCart(userId, body.productId);
      return state
        ? Response.json(state, { headers: { "x-request-id": requestContext.requestId } })
        : apiError(requestContext, 409, "PRODUCT_UNAVAILABLE", "That product is unavailable.");
    }
    if (body.action === "cart:update") {
      const state = await updateCart(userId, body.productId, body.quantity);
      return state
        ? Response.json(state, { headers: { "x-request-id": requestContext.requestId } })
        : apiError(requestContext, 409, "PRODUCT_UNAVAILABLE", "That product is unavailable.");
    }
    if (body.action === "wishlist:toggle") {
      const state = await toggleWishlist(userId, body.productId);
      return state
        ? Response.json(state, { headers: { "x-request-id": requestContext.requestId } })
        : apiError(requestContext, 409, "PRODUCT_UNAVAILABLE", "That product is unavailable.");
    }
    if (body.action === "order:cancel") {
      const result = await cancelOrder(userId, body.orderId, body.reason);
      if ("error" in result && result.error)
        return apiError(requestContext, 409, "CANCELLATION_REJECTED", result.error);
      return Response.json(
        { state: await getState(userId), ...result },
        { headers: { "x-request-id": requestContext.requestId } }
      );
    }
    if (body.action === "order:reorder") {
      const result = await reorderOrder(userId, body.orderId);
      if ("error" in result && result.error)
        return apiError(requestContext, 409, "REORDER_REJECTED", result.error);
      return Response.json(result, { headers: { "x-request-id": requestContext.requestId } });
    }
    if (body.action !== "order:create")
      return apiError(requestContext, 400, "UNKNOWN_ACTION", "Unknown store action.");
    const result = await createOrder(userId, {
      address: body.address,
      instructions: body.delivery.instructions,
      slotId: body.delivery.slotId,
      idempotencyKey: body.idempotencyKey,
      discountCode: body.discountCode,
    });
    if ("error" in result && result.error)
      return apiError(requestContext, 409, "ORDER_REJECTED", result.error);
    return Response.json(await getState(userId), {
      headers: { "x-request-id": requestContext.requestId },
    });
  } catch (error) {
    logRequestError("store.action_failed", error, requestContext);
    return apiError(
      requestContext,
      503,
      "STORE_ACTION_UNAVAILABLE",
      "We could not complete that action. Please try again."
    );
  }
}
