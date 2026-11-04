import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import { buildKnowledgeGraph } from "@/server/search";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser("read");
    const { searchParams } = new URL(req.url);
    const maxNodes = Number(searchParams.get("maxNodes") ?? "45");
    const minSimilarity = Number(searchParams.get("minSimilarity") ?? "0.35");

    const graph = await buildKnowledgeGraph(user.id, {
      maxNodes: Number.isFinite(maxNodes) ? maxNodes : 45,
      minSimilarity: Number.isFinite(minSimilarity) ? minSimilarity : 0.35,
    });

    return NextResponse.json(graph);
  } catch (err) {
    return handleApiError(err);
  }
}

