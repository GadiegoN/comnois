import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import { searchLibrary } from "@/server/search";
import {
  createLinkItem,
  createNoteItem,
  createUploadedFileItem,
} from "@/server/services/items";
import { processNextJobsBatch } from "@/server/jobs/queue";
import { ValidationError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser("read");
    const { searchParams } = new URL(req.url);

    const query = searchParams.get("q") ?? undefined;
    const mode = (searchParams.get("mode") as "lexical" | "semantic" | "hybrid") || "lexical";
    const type = searchParams.get("type") as "link" | "note" | "file" | "image" | null;
    const collectionId = searchParams.get("collectionId") ?? undefined;
    const tagIdsRaw = searchParams.get("tagIds");
    const tagIds = tagIdsRaw ? tagIdsRaw.split(",").filter(Boolean) : undefined;
    const tagMatchMode = (searchParams.get("tagMatchMode") as "and" | "or") || "and";
    const isFavoriteParam = searchParams.get("isFavorite");
    const isArchivedParam = searchParams.get("isArchived");
    const includeArchived = searchParams.get("includeArchived") === "true";
    const processingStatus = searchParams.get("processingStatus") as
      | "pending"
      | "processing"
      | "completed"
      | "partial"
      | "failed"
      | "cancelled"
      | null;
    const sortBy = (searchParams.get("sortBy") as "newest" | "oldest" | "updated" | "relevance") || undefined;
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");
    const workspaceId = searchParams.get("workspaceId") || undefined;

    const searchResult = await searchLibrary({
      ownerId: user.id,
      workspaceId,
      query,
      mode,
      type: type || undefined,
      collectionId,
      tagIds,
      tagMatchMode,
      isFavorite: isFavoriteParam === "true" ? true : isFavoriteParam === "false" ? false : undefined,
      isArchived: isArchivedParam === "true" ? true : isArchivedParam === "false" ? false : undefined,
      includeArchived,
      processingStatus: processingStatus || undefined,
      sortBy,
      page,
      pageSize,
    });

    return NextResponse.json(searchResult);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        throw new ValidationError("Selecione um arquivo válido para enviar.");
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const title = (formData.get("title") as string) || undefined;
      const summary = (formData.get("summary") as string) || undefined;
      const ocrText = (formData.get("ocrText") as string) || undefined;
      const tagsRaw = (formData.get("tags") as string) || "";
      const tags = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const collectionId = (formData.get("collectionId") as string) || undefined;

      const created = await createUploadedFileItem({
        ownerId: user.id,
        fileName: file.name,
        declaredMimeType: file.type,
        buffer,
        title,
        summary,
        ocrText,
        tags,
        collectionId,
      });

      // Trigger asynchronous worker batch in background without blocking if it takes long
      void processNextJobsBatch({ limit: 2 }).catch(() => {});

      return NextResponse.json(created, { status: 201 });
    }

    const body = await req.json();
    const itemType = body.type ?? "link";

    if (itemType === "note") {
      const created = await createNoteItem(user.id, body);
      return NextResponse.json(created, { status: 201 });
    }

    const created = await createLinkItem(user.id, body);
    // Trigger background worker non-blocking
    void processNextJobsBatch({ limit: 2 }).catch(() => {});

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

