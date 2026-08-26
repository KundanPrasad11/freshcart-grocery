import { auth } from "@/auth";
import { apiError, isResponse, readJson } from "@/lib/http";
import { createRequestContext, logInfo, logRequestError } from "@/lib/logger";
import { adminActionSchema } from "@/lib/schemas";
import {
  adminSetStock,
  adminUpdateOrderFulfillment,
  adminUpdateOrderStatus,
  adminUpdateUserRole,
  adminUpsertCategory,
  adminUpsertDiscount,
  adminUpsertProduct,
  findUserByEmail,
  getAdminData,
} from "@/lib/store-repository";

async function adminForRequest() {
  const email = (await auth())?.user?.email;
  if (!email) return null;
  const user = await findUserByEmail(email);
  return user?.role === "admin" ? user : null;
}

export async function GET(request: Request) {
  const requestContext = createRequestContext(request);
  try {
    const admin = await adminForRequest();
    if (!admin) return apiError(requestContext, 403, "ADMIN_REQUIRED", "Admin access is required.");
    return Response.json(await getAdminData(), {
      headers: { "x-request-id": requestContext.requestId },
    });
  } catch (error) {
    logRequestError("admin.read_failed", error, requestContext);
    return apiError(
      requestContext,
      503,
      "ADMIN_UNAVAILABLE",
      "Admin data is temporarily unavailable."
    );
  }
}

export async function POST(request: Request) {
  const requestContext = createRequestContext(request);
  try {
    const admin = await adminForRequest();
    if (!admin) return apiError(requestContext, 403, "ADMIN_REQUIRED", "Admin access is required.");
    const body = await readJson(request, adminActionSchema, {
      maxBytes: 16 * 1024,
      requestContext,
    });
    if (isResponse(body)) return body;
    if (body.action === "product:upsert") await adminUpsertProduct(body.product);
    if (body.action === "product:stock") {
      const result = await adminSetStock(body.productId, body.stockQuantity);
      if ("error" in result && result.error)
        return apiError(requestContext, 409, "STOCK_UPDATE_REJECTED", result.error);
    }
    if (body.action === "category:upsert") await adminUpsertCategory(body.category);
    if (body.action === "discount:upsert") await adminUpsertDiscount(body.discount);
    if (body.action === "order:status") {
      const result = await adminUpdateOrderStatus(body.orderId, body.status, admin.id);
      if ("error" in result && result.error)
        return apiError(requestContext, 409, "ORDER_TRANSITION_REJECTED", result.error);
    }
    if (body.action === "order:fulfillment") {
      const result = await adminUpdateOrderFulfillment(body.orderId, body.status, admin.id, body.reason);
      if ("error" in result && result.error)
        return apiError(requestContext, 409, "ORDER_TRANSITION_REJECTED", result.error);
    }
    if (body.action === "user:role") await adminUpdateUserRole(body.userId, body.role);
    logInfo("admin.action", { adminId: admin.id, action: body.action });
    return Response.json(
      { ok: true, requestId: requestContext.requestId },
      { headers: { "x-request-id": requestContext.requestId } }
    );
  } catch (error) {
    logRequestError("admin.action_failed", error, requestContext);
    return apiError(
      requestContext,
      503,
      "ADMIN_ACTION_UNAVAILABLE",
      "Could not save the admin change."
    );
  }
}
