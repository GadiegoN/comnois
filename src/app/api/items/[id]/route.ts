import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  createOfflineSnapshotForItem,
  deleteItem,
  exportSingleItemAsMarkdown,
  getItemDetail,
  updateItem,
} from "@/server/services/items";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser("read");
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);

    if (searchParams.get("format") === "markdown") {
      const exported = await exportSingleItemAsMarkdown(user.id, id);
      return new NextResponse(exported.markdown, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exported.fileName}"`,
        },
      });
    }

    const detail = await getItemDetail(user.id, id);
    return NextResponse.json(detail);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser("write");
    const { id } = await context.params;
    const body = await req.json();

    if (body.action === "create_snapshot") {
      const snapshot = await createOfflineSnapshotForItem(user.id, id);
      const detail = await getItemDetail(user.id, id);
      return NextResponse.json({ snapshot, detail }, { status: 201 });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser("write");
    const { id } = await context.params;
    const body = await req.json();
    const updated = await updateItem(user.id, id, body);
    return NextResponse.json(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser("write");
    const { id } = await context.params;
    await deleteItem(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

