import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import { deleteItem, getItemDetail, updateItem } from "@/server/services/items";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireCurrentUser("read");
    const { id } = await context.params;
    const detail = await getItemDetail(user.id, id);
    return NextResponse.json(detail);
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

