import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  buildKnowledgeGraph,
  exportKnowledgeGraphAsMermaid,
} from "@/server/search";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser("read");
    const { searchParams } = new URL(req.url);
    const maxNodes = Number(searchParams.get("maxNodes") ?? "45");
    const minSimilarity = Number(searchParams.get("minSimilarity") ?? "0.35");
    const workspaceId = searchParams.get("workspaceId") || undefined;
    const format = searchParams.get("format");

    const graph = await buildKnowledgeGraph(user.id, {
      maxNodes: Number.isFinite(maxNodes) ? maxNodes : 45,
      minSimilarity: Number.isFinite(minSimilarity) ? minSimilarity : 0.35,
      workspaceId,
    });
    const mermaid = exportKnowledgeGraphAsMermaid(graph);

    if (format === "mermaid") {
      return new NextResponse(mermaid, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": 'attachment; filename="comnois-graph.mmd"',
        },
      });
    }

    return NextResponse.json({ ...graph, mermaid });
  } catch (err) {
    return handleApiError(err);
  }
}

