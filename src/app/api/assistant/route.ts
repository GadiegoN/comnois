import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import { askKnowledgeAssistant } from "@/server/ai/assistant";

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const body = await req.json();

    const response = await askKnowledgeAssistant({
      ownerId: user.id,
      workspaceId: body.workspaceId ?? null,
      question: body.question ?? "",
      itemIdsFilter: Array.isArray(body.itemIdsFilter) ? body.itemIdsFilter : undefined,
      maxSources: body.maxSources,
    });

    return NextResponse.json(response);
  } catch (err) {
    return handleApiError(err);
  }
}

