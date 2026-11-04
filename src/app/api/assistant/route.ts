import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  askKnowledgeAssistant,
  deleteAssistantConversation,
  getAssistantConversationMessages,
  listAssistantConversations,
  purgeAssistantHistory,
  saveAssistantAnswerAsNote,
} from "@/server/ai/assistant";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser("read");
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const workspaceId = searchParams.get("workspaceId") || null;

    if (conversationId) {
      const detail = await getAssistantConversationMessages(
        user.id,
        conversationId
      );
      return NextResponse.json(detail);
    }

    const conversations = await listAssistantConversations(user.id, workspaceId);
    return NextResponse.json({ conversations });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "saveAsNote") {
      const user = await requireCurrentUser("write");
      const saved = await saveAssistantAnswerAsNote({
        ownerId: user.id,
        workspaceId: body.workspaceId ?? null,
        question: body.question ?? "",
        answer: body.answer ?? "",
        directEvidenceSummary: body.directEvidenceSummary,
        synthesisNotes: body.synthesisNotes,
        citations: body.citations,
        tags: body.tags,
      });
      return NextResponse.json(saved, { status: 201 });
    }

    const user = await requireCurrentUser("read");
    const response = await askKnowledgeAssistant({
      ownerId: user.id,
      workspaceId: body.workspaceId ?? null,
      question: body.question ?? "",
      conversationId: body.conversationId ?? undefined,
      saveHistory: body.saveHistory !== false,
      itemIdsFilter: Array.isArray(body.itemIdsFilter) ? body.itemIdsFilter : undefined,
      maxSources: body.maxSources,
    });

    return NextResponse.json(response);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const olderThanDaysParam = searchParams.get("olderThanDays");

    if (conversationId) {
      await deleteAssistantConversation(user.id, conversationId);
      return NextResponse.json({ ok: true });
    }

    const olderThanDays = olderThanDaysParam
      ? Number(olderThanDaysParam)
      : undefined;
    const purged = await purgeAssistantHistory(user.id, { olderThanDays });
    return NextResponse.json({ ok: true, ...purged });
  } catch (err) {
    return handleApiError(err);
  }
}


