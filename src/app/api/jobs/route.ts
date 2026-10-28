import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  getQueueMetrics,
  processNextJobsBatch,
  recoverStaleJobs,
} from "@/server/jobs/queue";
import { reindexUserLibrary } from "@/server/search";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const metrics = await getQueueMetrics(user.id);
    return NextResponse.json(metrics);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const body = await req.json().catch(() => ({}));

    if (body.action === "reindex") {
      const reindexed = await reindexUserLibrary(user.id, {
        regenerateEmbeddings: body.regenerateEmbeddings ?? true,
      });
      return NextResponse.json({ reindexed });
    }

    if (body.action === "recoverStale") {
      const recovered = await recoverStaleJobs();
      return NextResponse.json({ recovered });
    }

    const batchResult = await processNextJobsBatch({
      limit: body.limit ?? 5,
    });
    const metrics = await getQueueMetrics(user.id);

    return NextResponse.json({ batchResult, metrics });
  } catch (err) {
    return handleApiError(err);
  }
}

