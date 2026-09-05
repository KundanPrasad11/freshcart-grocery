import { getCatalog } from "@/lib/store-repository";
import { logError } from "@/lib/logger";

// Database-backed catalogue data must not run during Vercel's static build.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getCatalog(), {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch (error) {
    logError("catalog.read_failed", error);
    return Response.json({ error: "Catalog is temporarily unavailable." }, { status: 503 });
  }
}
