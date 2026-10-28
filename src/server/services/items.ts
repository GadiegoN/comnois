import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  items,
  itemContents,
  assets,
  tags,
  itemTags,
  collections,
  collectionItems,
  highlights,
  processingJobs,
} from "@/db/schema";
import { generateId, sha256Hex } from "@/lib/security/crypto";
import { normalizeUrlForDeduplication } from "@/lib/security/url-normalizer";
import { sanitizeHtmlContent } from "@/lib/security/sanitize";
import { detectAndValidateFileType, getStorageProvider } from "@/server/storage";
import { enqueueJob } from "@/server/jobs/queue";
import { indexItemContent, removeItemFromSearchIndex } from "@/server/search";
import { normalizeSearchText } from "@/server/search/chunker";
import { requireWorkspaceRole } from "./workspaces";
import { dispatchWebhookEvent } from "./webhooks";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

export async function assertItemAccess(
  userId: string,
  itemId: string,
  minWorkspaceRole: "member" | "admin" | "owner" = "member"
) {
  const db = await getDb();
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

  if (!item) {
    throw new NotFoundError("Item não encontrado.");
  }

  if (item.ownerId === userId) {
    return item;
  }

  if (item.workspaceId) {
    await requireWorkspaceRole(userId, item.workspaceId, minWorkspaceRole);
    return item;
  }

  throw new ForbiddenError("Você não tem permissão para acessar este item.");
}

export async function assignTagsToItem(input: {
  ownerId: string;
  workspaceId?: string | null;
  itemId: string;
  tagNames: string[];
  source?: "manual" | "ai" | "automation";
}): Promise<void> {
  const db = await getDb();
  const source = input.source ?? "manual";

  for (const rawName of input.tagNames) {
    const cleanName = rawName.trim().slice(0, 60);
    const normName = normalizeSearchText(cleanName);
    if (!normName) continue;

    let [tagRow] = await db
      .select()
      .from(tags)
      .where(and(eq(tags.ownerId, input.ownerId), eq(tags.normalizedName, normName)))
      .limit(1);

    if (!tagRow) {
      const tagId = generateId("tag");
      await db.insert(tags).values({
        id: tagId,
        ownerId: input.ownerId,
        workspaceId: input.workspaceId ?? null,
        name: cleanName,
        normalizedName: normName,
        createdAt: new Date(),
      });
      [tagRow] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
    }

    if (!tagRow) continue;

    const [existingAssoc] = await db
      .select()
      .from(itemTags)
      .where(and(eq(itemTags.itemId, input.itemId), eq(itemTags.tagId, tagRow.id)))
      .limit(1);

    if (!existingAssoc) {
      await db.insert(itemTags).values({
        id: generateId("itg"),
        itemId: input.itemId,
        tagId: tagRow.id,
        source,
        isConfirmed: source === "manual",
        createdAt: new Date(),
      });
    } else if (source === "manual" && existingAssoc.source !== "manual") {
      // Promote AI tag to confirmed manual tag if explicitly added by user
      await db
        .update(itemTags)
        .set({ source: "manual", isConfirmed: true })
        .where(eq(itemTags.id, existingAssoc.id));
    }
  }
}

export const createLinkSchema = z.object({
  url: z.string().trim().min(1, "Informe uma URL."),
  title: z.string().trim().max(300).optional(),
  summary: z.string().trim().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  collectionId: z.string().optional(),
  workspaceId: z.string().nullable().optional(),
  allowDuplicate: z.boolean().optional(),
});

export async function createLinkItem(
  ownerId: string,
  input: z.infer<typeof createLinkSchema>
) {
  const parsed = createLinkSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Dados do link inválidos.");
  }

  if (parsed.data.workspaceId) {
    await requireWorkspaceRole(ownerId, parsed.data.workspaceId, "member");
  }

  const urlInfo = normalizeUrlForDeduplication(parsed.data.url);
  const db = await getDb();

  // Check duplicate in user scope
  const existingDuplicates = await db
    .select()
    .from(items)
    .where(
      and(
        eq(items.ownerId, ownerId),
        eq(items.normalizedUrl, urlInfo.normalizedUrl)
      )
    )
    .limit(1);

  const duplicateOf = existingDuplicates[0] ?? null;

  const itemId = generateId("itm");
  const now = new Date();
  const userProvidedTitle = Boolean(parsed.data.title && parsed.data.title.trim().length > 0);
  const resolvedTitle = userProvidedTitle
    ? parsed.data.title!.trim()
    : urlInfo.originalUrl;

  await db.insert(items).values({
    id: itemId,
    ownerId,
    workspaceId: parsed.data.workspaceId ?? null,
    type: "link",
    title: resolvedTitle,
    originalUrl: urlInfo.originalUrl,
    normalizedUrl: urlInfo.normalizedUrl,
    domain: urlInfo.domain,
    summary: parsed.data.summary ?? null,
    summarySource: parsed.data.summary ? "manual" : null,
    metadata: {
      userProvidedTitle,
      ...(duplicateOf ? { duplicateOfItemId: duplicateOf.id } : {}),
    },
    processingStatus: "pending",
    processingError: null,
    isFavorite: false,
    isArchived: false,
    contentVersion: 1,
    createdAt: now,
    updatedAt: now,
  });

  if (parsed.data.tags && parsed.data.tags.length > 0) {
    await assignTagsToItem({
      ownerId,
      workspaceId: parsed.data.workspaceId,
      itemId,
      tagNames: parsed.data.tags,
      source: "manual",
    });
  }

  if (parsed.data.collectionId) {
    await db.insert(collectionItems).values({
      id: generateId("ci"),
      collectionId: parsed.data.collectionId,
      itemId,
      createdAt: now,
    });
  }

  // Index initial metadata immediately so title/domain are searchable right away
  await indexItemContent(itemId, { generateEmbeddings: false, expectedContentVersion: 1 });

  // Enqueue asynchronous extraction job
  const { jobId } = await enqueueJob({
    ownerId,
    itemId,
    jobType: "fetch_link",
    targetContentVersion: 1,
  });

  const [created] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

  void dispatchWebhookEvent(ownerId, "item.created", {
    itemId: created.id,
    type: created.type,
    title: created.title,
    url: created.originalUrl,
  }).catch(() => {});

  return {
    item: created,
    jobId,
    duplicateWarning: duplicateOf
      ? {
          existingItemId: duplicateOf.id,
          existingTitle: duplicateOf.title,
          message: "Já existe um link com este endereço normalizado na sua biblioteca.",
        }
      : null,
  };
}

export const createNoteSchema = z.object({
  title: z.string().trim().max(300).optional(),
  content: z.string().trim().min(1, "O conteúdo da nota não pode estar vazio.").max(200_000),
  summary: z.string().trim().max(1000).optional(),
  tags: z.array(z.string()).optional(),
  collectionId: z.string().optional(),
  workspaceId: z.string().nullable().optional(),
});

export async function createNoteItem(
  ownerId: string,
  input: z.infer<typeof createNoteSchema>
) {
  const parsed = createNoteSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Nota inválida.");
  }

  if (parsed.data.workspaceId) {
    await requireWorkspaceRole(ownerId, parsed.data.workspaceId, "member");
  }

  const db = await getDb();
  const itemId = generateId("itm");
  const now = new Date();
  const cleanNote = parsed.data.content.trim();
  const autoTitle =
    parsed.data.title && parsed.data.title.trim().length > 0
      ? parsed.data.title.trim()
      : cleanNote.split("\n")[0].slice(0, 80) || "Nota sem título";

  await db.insert(items).values({
    id: itemId,
    ownerId,
    workspaceId: parsed.data.workspaceId ?? null,
    type: "note",
    title: autoTitle,
    summary: parsed.data.summary ?? cleanNote.slice(0, 240),
    summarySource: parsed.data.summary ? "manual" : "extracted",
    metadata: {},
    processingStatus: "completed",
    processingError: null,
    isFavorite: false,
    isArchived: false,
    contentVersion: 1,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(itemContents).values({
    id: generateId("cnt"),
    itemId,
    noteText: cleanNote,
    extractedText: cleanNote,
    sanitizedHtml: sanitizeHtmlContent(`<p>${cleanNote.replace(/\n\n+/g, "</p><p>")}</p>`),
    language: "pt",
    extractionOrigin: "user_note",
    extractorVersion: "1.0.0",
    contentHash: sha256Hex(cleanNote),
    contentVersion: 1,
    createdAt: now,
    updatedAt: now,
  });

  if (parsed.data.tags && parsed.data.tags.length > 0) {
    await assignTagsToItem({
      ownerId,
      workspaceId: parsed.data.workspaceId,
      itemId,
      tagNames: parsed.data.tags,
      source: "manual",
    });
  }

  if (parsed.data.collectionId) {
    await db.insert(collectionItems).values({
      id: generateId("ci"),
      collectionId: parsed.data.collectionId,
      itemId,
      createdAt: now,
    });
  }

  // Notes do not depend on an external extraction service; index immediately
  await indexItemContent(itemId, { generateEmbeddings: true, expectedContentVersion: 1 });

  const [created] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

  void dispatchWebhookEvent(ownerId, "item.created", {
    itemId: created.id,
    type: created.type,
    title: created.title,
  }).catch(() => {});

  return { item: created };
}

export async function createUploadedFileItem(input: {
  ownerId: string;
  workspaceId?: string | null;
  fileName: string;
  declaredMimeType?: string;
  buffer: Buffer;
  title?: string;
  summary?: string;
  ocrText?: string;
  tags?: string[];
  collectionId?: string;
}) {
  if (input.workspaceId) {
    await requireWorkspaceRole(input.ownerId, input.workspaceId, "member");
  }

  const { itemType } = detectAndValidateFileType(
    input.fileName,
    input.buffer,
    input.declaredMimeType
  );

  const storage = getStorageProvider();
  const stored = await storage.putObject({
    ownerId: input.ownerId,
    originalFileName: input.fileName,
    declaredMimeType: input.declaredMimeType,
    buffer: input.buffer,
  });

  const db = await getDb();
  const itemId = generateId("itm");
  const assetId = generateId("ast");
  const now = new Date();

  const resolvedTitle =
    input.title && input.title.trim().length > 0
      ? input.title.trim()
      : stored.originalFileName;

  await db.insert(items).values({
    id: itemId,
    ownerId: input.ownerId,
    workspaceId: input.workspaceId ?? null,
    type: itemType,
    title: resolvedTitle,
    summary: input.summary ?? null,
    summarySource: input.summary ? "manual" : null,
    metadata: {
      originalFileName: stored.originalFileName,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      sha256Hash: stored.sha256Hash,
      ...(input.ocrText ? { ocrText: input.ocrText } : {}),
    },
    processingStatus: "pending",
    processingError: null,
    isFavorite: false,
    isArchived: false,
    contentVersion: 1,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(assets).values({
    id: assetId,
    itemId,
    ownerId: input.ownerId,
    storageKey: stored.storageKey,
    storageDriver: stored.storageDriver,
    originalFileName: stored.originalFileName,
    mimeType: stored.mimeType,
    sizeBytes: stored.sizeBytes,
    sha256Hash: stored.sha256Hash,
    verificationStatus: "verified",
    createdAt: now,
  });

  if (input.tags && input.tags.length > 0) {
    await assignTagsToItem({
      ownerId: input.ownerId,
      workspaceId: input.workspaceId,
      itemId,
      tagNames: input.tags,
      source: "manual",
    });
  }

  if (input.collectionId) {
    await db.insert(collectionItems).values({
      id: generateId("ci"),
      collectionId: input.collectionId,
      itemId,
      createdAt: now,
    });
  }

  const jobType = itemType === "image" ? "ocr_asset" : "extract_content";
  const { jobId } = await enqueueJob({
    ownerId: input.ownerId,
    itemId,
    jobType,
    targetContentVersion: 1,
  });

  const [created] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

  void dispatchWebhookEvent(input.ownerId, "item.created", {
    itemId: created.id,
    type: created.type,
    title: created.title,
  }).catch(() => {});

  return {
    item: created,
    assetId,
    jobId,
  };
}

export async function getItemDetail(userId: string, itemId: string) {
  const item = await assertItemAccess(userId, itemId);
  const db = await getDb();

  const [content] = await db
    .select()
    .from(itemContents)
    .where(eq(itemContents.itemId, itemId))
    .limit(1);

  const itemAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.itemId, itemId));

  const assignedTags = await db
    .select({
      id: tags.id,
      name: tags.name,
      normalizedName: tags.normalizedName,
      source: itemTags.source,
      isConfirmed: itemTags.isConfirmed,
    })
    .from(itemTags)
    .innerJoin(tags, eq(itemTags.tagId, tags.id))
    .where(eq(itemTags.itemId, itemId));

  const assignedCollections = await db
    .select({
      id: collections.id,
      name: collections.name,
    })
    .from(collectionItems)
    .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
    .where(eq(collectionItems.itemId, itemId));

  const itemHighlights = await db
    .select()
    .from(highlights)
    .where(eq(highlights.itemId, itemId))
    .orderBy(desc(highlights.createdAt));

  const jobs = await db
    .select()
    .from(processingJobs)
    .where(eq(processingJobs.itemId, itemId))
    .orderBy(desc(processingJobs.createdAt));

  return {
    item,
    content: content ?? null,
    assets: itemAssets.map((a) => ({
      id: a.id,
      originalFileName: a.originalFileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      sha256Hash: a.sha256Hash,
      createdAt: a.createdAt,
      downloadUrl: `/api/assets/${a.id}`,
    })),
    tags: assignedTags,
    collections: assignedCollections,
    highlights: itemHighlights,
    jobs,
  };
}

export async function updateItem(
  userId: string,
  itemId: string,
  input: {
    title?: string;
    summary?: string | null;
    noteText?: string;
    isFavorite?: boolean;
    isArchived?: boolean;
    tags?: string[];
  }
) {
  const existing = await assertItemAccess(userId, itemId);
  const db = await getDb();
  const now = new Date();

  const contentChanged =
    (input.title !== undefined && input.title.trim() !== existing.title) ||
    (input.summary !== undefined && input.summary !== existing.summary) ||
    input.noteText !== undefined;

  const nextVersion = contentChanged
    ? existing.contentVersion + 1
    : existing.contentVersion;

  await db
    .update(items)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() || existing.title } : {}),
      ...(input.summary !== undefined
        ? { summary: input.summary, summarySource: "manual" }
        : {}),
      ...(input.isFavorite !== undefined ? { isFavorite: input.isFavorite } : {}),
      ...(input.isArchived !== undefined ? { isArchived: input.isArchived } : {}),
      contentVersion: nextVersion,
      metadata: {
        ...existing.metadata,
        ...(input.title !== undefined ? { userProvidedTitle: true } : {}),
      },
      updatedAt: now,
    })
    .where(eq(items.id, itemId));

  if (input.noteText !== undefined) {
    const cleanNote = input.noteText.trim();
    const [existingContent] = await db
      .select()
      .from(itemContents)
      .where(eq(itemContents.itemId, itemId))
      .limit(1);

    if (existingContent) {
      await db
        .update(itemContents)
        .set({
          noteText: cleanNote,
          extractedText: existing.type === "note" ? cleanNote : existingContent.extractedText,
          contentHash: sha256Hex(cleanNote),
          contentVersion: nextVersion,
          updatedAt: now,
        })
        .where(eq(itemContents.itemId, itemId));
    } else {
      await db.insert(itemContents).values({
        id: generateId("cnt"),
        itemId,
        noteText: cleanNote,
        extractedText: cleanNote,
        language: "pt",
        extractionOrigin: "user_note",
        extractorVersion: "1.0.0",
        contentHash: sha256Hex(cleanNote),
        contentVersion: nextVersion,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (input.tags !== undefined) {
    await db.delete(itemTags).where(eq(itemTags.itemId, itemId));
    if (input.tags.length > 0) {
      await assignTagsToItem({
        ownerId: existing.ownerId,
        workspaceId: existing.workspaceId,
        itemId,
        tagNames: input.tags,
        source: "manual",
      });
    }
  }

  if (contentChanged) {
    await indexItemContent(itemId, {
      generateEmbeddings: true,
      expectedContentVersion: nextVersion,
    });
  }

  return getItemDetail(userId, itemId);
}

export async function deleteItem(userId: string, itemId: string): Promise<void> {
  const existing = await assertItemAccess(userId, itemId);
  const db = await getDb();

  // 1. Delete physical files from private storage
  const itemAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.itemId, existing.id));

  const storage = getStorageProvider();
  for (const asset of itemAssets) {
    await storage.deleteObject(asset.storageKey);
  }

  // 2. Remove derived chunks and embeddings
  await removeItemFromSearchIndex(existing.id);

  // 3. Cancel any pending jobs and delete item (cascade deletes contents, itemTags, collectionItems, highlights, assets, jobs)
  await db.delete(items).where(eq(items.id, existing.id));

  void dispatchWebhookEvent(existing.ownerId, "item.deleted", {
    itemId: existing.id,
    type: existing.type,
    title: existing.title,
  }).catch(() => {});
}

export async function retryItemProcessing(
  userId: string,
  itemId: string
): Promise<{ jobId: string }> {
  const item = await assertItemAccess(userId, itemId);
  const db = await getDb();

  await db
    .update(items)
    .set({
      processingStatus: "pending",
      processingError: null,
      updatedAt: new Date(),
    })
    .where(eq(items.id, item.id));

  let jobType: "fetch_link" | "extract_content" | "ocr_asset" | "chunk_and_index" =
    "chunk_and_index";

  if (item.type === "link") {
    jobType = "fetch_link";
  } else if (item.type === "file") {
    jobType = "extract_content";
  } else if (item.type === "image") {
    jobType = "ocr_asset";
  }

  const { jobId } = await enqueueJob({
    ownerId: item.ownerId,
    itemId: item.id,
    jobType,
    targetContentVersion: item.contentVersion,
    forceImmediate: true,
  });

  return { jobId };
}

export async function executeBatchItemAction(input: {
  userId: string;
  itemIds: string[];
  action: "archive" | "unarchive" | "favorite" | "unfavorite" | "delete" | "addTag" | "addToCollection";
  tagName?: string;
  collectionId?: string;
}): Promise<{
  processedIds: string[];
  failedItems: Array<{ itemId: string; reason: string }>;
}> {
  const processedIds: string[] = [];
  const failedItems: Array<{ itemId: string; reason: string }> = [];

  for (const itemId of input.itemIds) {
    try {
      if (input.action === "delete") {
        await deleteItem(input.userId, itemId);
      } else if (input.action === "archive") {
        await updateItem(input.userId, itemId, { isArchived: true });
      } else if (input.action === "unarchive") {
        await updateItem(input.userId, itemId, { isArchived: false });
      } else if (input.action === "favorite") {
        await updateItem(input.userId, itemId, { isFavorite: true });
      } else if (input.action === "unfavorite") {
        await updateItem(input.userId, itemId, { isFavorite: false });
      } else if (input.action === "addTag") {
        if (!input.tagName?.trim()) {
          throw new ValidationError("Nome da etiqueta não informado.");
        }
        const item = await assertItemAccess(input.userId, itemId);
        await assignTagsToItem({
          ownerId: item.ownerId,
          workspaceId: item.workspaceId,
          itemId: item.id,
          tagNames: [input.tagName],
          source: "manual",
        });
      } else if (input.action === "addToCollection") {
        if (!input.collectionId) {
          throw new ValidationError("Coleção não informada.");
        }
        await assertItemAccess(input.userId, itemId);
        const db = await getDb();
        const existing = await db
          .select()
          .from(collectionItems)
          .where(
            and(
              eq(collectionItems.collectionId, input.collectionId),
              eq(collectionItems.itemId, itemId)
            )
          )
          .limit(1);
        if (existing.length === 0) {
          await db.insert(collectionItems).values({
            id: generateId("ci"),
            collectionId: input.collectionId,
            itemId,
            createdAt: new Date(),
          });
        }
      }
      processedIds.push(itemId);
    } catch (err) {
      failedItems.push({
        itemId,
        reason: err instanceof Error ? err.message : "Falha ao processar item.",
      });
    }
  }

  return { processedIds, failedItems };
}
