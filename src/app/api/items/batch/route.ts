import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import { executeBatchItemAction } from "@/server/services/items";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const body = await req.json();

    const result = await executeBatchItemAction({
      userId: user.id,
      itemIds: Array.isArray(body.itemIds) ? body.itemIds : [],
      action: body.action,
      tagName: body.tagName,
      collectionId: body.collectionId,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}

