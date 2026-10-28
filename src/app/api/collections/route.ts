import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  addItemToCollection,
  createCollection,
  deleteCollection,
  listUserCollections,
  moveCollection,
  removeItemFromCollection,
  renameCollection,
} from "@/server/services/organization";

export async function GET() {
  try {
    const user = await requireCurrentUser("read");
    const collections = await listUserCollections(user.id);
    return NextResponse.json({ collections });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const body = await req.json();

    if (body.action === "addItem") {
      await addItemToCollection(user.id, body.collectionId, body.itemId);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "removeItem") {
      await removeItemFromCollection(user.id, body.collectionId, body.itemId);
      return NextResponse.json({ ok: true });
    }

    const collection = await createCollection({
      ownerId: user.id,
      name: body.name ?? "",
      description: body.description,
      parentId: body.parentId ?? null,
      type: body.type === "smart" ? "smart" : "manual",
      smartRules: body.smartRules,
    });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const body = await req.json();

    if (body.action === "move") {
      const moved = await moveCollection(
        user.id,
        body.collectionId ?? "",
        body.parentId ?? null
      );
      return NextResponse.json({ collection: moved });
    }

    const updated = await renameCollection(
      user.id,
      body.collectionId ?? "",
      body.name ?? "",
      body.description
    );
    return NextResponse.json({ collection: updated });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const { searchParams } = new URL(req.url);
    const collectionId = searchParams.get("collectionId") ?? "";
    await deleteCollection(user.id, collectionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
