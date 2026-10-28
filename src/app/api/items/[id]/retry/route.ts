import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import { getItemDetail, retryItemProcessing } from "@/server/services/items";
import { processNextJobsBatch } from "@/server/jobs/queue";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const { jobId } = await retryItemProcessing(user.id, id);
    await processNextJobsBatch({ limit: 3 });
    const detail = await getItemDetail(user.id, id);
    return NextResponse.json({ jobId, detail });
  } catch (err) {
    return handleApiError(err);
  }
}

