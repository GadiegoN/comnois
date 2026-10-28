import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  confirmOrRejectItemTag,
  deleteTag,
  listUserTags,
  renameTag,
} from "@/server/services/organization";

export async function GET() {
  try {
    const user = await requireCurrentUser("read");
    const tags = await listUserTags(user.id);
    return NextResponse.json({ tags });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const body = await req.json();

    if (body.action === "confirmTag" || body.action === "rejectTag") {
      await confirmOrRejectItemTag({
        ownerId: user.id,
        itemId: body.itemId ?? "",
        tagId: body.tagId ?? "",
        decision: body.action === "confirmTag" ? "confirm" : "reject",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const body = await req.json();
    const updated = await renameTag(user.id, body.tagId ?? "", body.name ?? "");
    return NextResponse.json({ tag: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const { searchParams } = new URL(req.url);
    const tagId = searchParams.get("tagId") ?? "";
    await deleteTag(user.id, tagId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
