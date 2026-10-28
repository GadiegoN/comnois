import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assets } from "@/db/schema";
import { requireCurrentUser, handleApiError } from "@/server/http";
import { assertItemAccess } from "@/server/services/items";
import { getStorageProvider } from "@/server/storage";
import { NotFoundError } from "@/lib/errors";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id: assetId } = await context.params;
    const db = await getDb();

    const [assetRecord] = await db
      .select()
      .from(assets)
      .where(eq(assets.id, assetId))
      .limit(1);

    if (!assetRecord) {
      throw new NotFoundError("Arquivo não encontrado.");
    }

    // Verify server-side authorization on the parent item!
    await assertItemAccess(user.id, assetRecord.itemId);

    const storage = getStorageProvider();
    const fileBuffer = await storage.getObject(assetRecord.storageKey);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": assetRecord.mimeType,
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(assetRecord.originalFileName)}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

