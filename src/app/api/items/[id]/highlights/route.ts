import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import { createHighlight, deleteHighlight } from "@/server/services/organization";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser();
    const { id } = await context.params;
    const body = await req.json();
    const created = await createHighlight({
      ownerId: user.id,
      itemId: id,
      quote: body.quote ?? "",
      note: body.note,
      startOffset: body.startOffset,
      endOffset: body.endOffset,
    });
    return NextResponse.json({ highlight: created }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const { searchParams } = new URL(req.url);
    const highlightId = searchParams.get("highlightId") ?? "";
    await deleteHighlight(user.id, highlightId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

