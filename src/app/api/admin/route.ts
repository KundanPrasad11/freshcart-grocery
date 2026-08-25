import { auth } from "@/auth";
import { isResponse, readJson } from "@/lib/http";
import { logError, logInfo } from "@/lib/logger";
import { adminActionSchema } from "@/lib/schemas";
import {
  adminSetStock,
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

export async function GET() {
  try {
    const admin = await adminForRequest();
    if (!admin) return Response.json({ error: "Admin access is required." }, { status: 403 });
    return Response.json(await getAdminData());
  } catch (error) {
    logError("admin.read_failed", error);
    return Response.json({ error: "Admin data is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await adminForRequest();
    if (!admin) return Response.json({ error: "Admin access is required." }, { status: 403 });
    const body = await readJson(request, adminActionSchema);
    if (isResponse(body)) return body;
    if (body.action === "product:upsert") await adminUpsertProduct(body.product);
    if (body.action === "product:stock") await adminSetStock(body.productId, body.stockQuantity);
    if (body.action === "category:upsert") await adminUpsertCategory(body.category);
    if (body.action === "discount:upsert") await adminUpsertDiscount(body.discount);
    if (body.action === "order:status") await adminUpdateOrderStatus(body.orderId, body.status);
    if (body.action === "user:role") await adminUpdateUserRole(body.userId, body.role);
    logInfo("admin.action", { adminId: admin.id, action: body.action });
    return Response.json({ ok: true });
  } catch (error) {
    logError("admin.action_failed", error);
    return Response.json({ error: "Could not save the admin change." }, { status: 503 });
  }
}
