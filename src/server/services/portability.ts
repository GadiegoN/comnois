import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import * as cheerio from "cheerio";
import { getDb } from "@/db";
import {
  items,
  itemContents,
  tags,
  itemTags,
  collections,
  collectionItems,
  highlights,
} from "@/db/schema";
import { generateId, sha256Hex } from "@/lib/security/crypto";
import { normalizeUrlForDeduplication } from "@/lib/security/url-normalizer";
import { sanitizeHtmlContent } from "@/lib/security/sanitize";
import { indexItemContent } from "@/server/search";
import { assignTagsToItem } from "./items";
import { normalizeSearchText } from "@/server/search/chunker";
import { ValidationError } from "@/lib/errors";

export const EXPORT_FORMAT_VERSION = "comnois-export-v1";

export interface PortableExportBundle {
  formatVersion: string;
  exportedAt: string;
  manifest: {
    totalItemsExported: number;
    totalCollectionsExported: number;
    totalTagsExported: number;
    omittedItems: Array<{ itemId: string; title: string; reason: string }>;
  };
  collections: Array<{
    name: string;
    description: string | null;
  }>;
  items: Array<{
    externalId: string;
    type: "link" | "note" | "file" | "image";
    title: string;
    originalUrl: string | null;
    summary: string | null;
    noteText: string | null;
    extractedText: string | null;
    isFavorite: boolean;
    isArchived: boolean;
    tags: string[];
    collections: string[];
    highlights: Array<{ quote: string; note: string | null }>;
    createdAt: string;
  }>;
}

export async function exportUserLibrary(ownerId: string): Promise<PortableExportBundle> {
  const db = await getDb();

  const userItems = await db
    .select()
    .from(items)
    .where(eq(items.ownerId, ownerId));

  const userCollections = await db
    .select()
    .from(collections)
    .where(eq(collections.ownerId, ownerId));

  const userTags = await db
    .select()
    .from(tags)
    .where(eq(tags.ownerId, ownerId));

  if (userItems.length === 0) {
    return {
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      manifest: {
        totalItemsExported: 0,
        totalCollectionsExported: userCollections.length,
        totalTagsExported: userTags.length,
        omittedItems: [],
      },
      collections: userCollections.map((c) => ({
        name: c.name,
        description: c.description,
      })),
      items: [],
    };
  }

  const itemIds = userItems.map((i) => i.id);
  const contents = await db
    .select()
    .from(itemContents)
    .where(inArray(itemContents.itemId, itemIds));
  const contentMap = new Map(contents.map((c) => [c.itemId, c]));

  const tagAssocs = await db
    .select({
      itemId: itemTags.itemId,
      tagName: tags.name,
    })
    .from(itemTags)
    .innerJoin(tags, eq(itemTags.tagId, tags.id))
    .where(inArray(itemTags.itemId, itemIds));

  const tagsByItem = new Map<string, string[]>();
  for (const row of tagAssocs) {
    const arr = tagsByItem.get(row.itemId) ?? [];
    arr.push(row.tagName);
    tagsByItem.set(row.itemId, arr);
  }

  const colAssocs = await db
    .select({
      itemId: collectionItems.itemId,
      collectionName: collections.name,
    })
    .from(collectionItems)
    .innerJoin(collections, eq(collectionItems.collectionId, collections.id))
    .where(inArray(collectionItems.itemId, itemIds));

  const colsByItem = new Map<string, string[]>();
  for (const row of colAssocs) {
    const arr = colsByItem.get(row.itemId) ?? [];
    arr.push(row.collectionName);
    colsByItem.set(row.itemId, arr);
  }

  const hltRows = await db
    .select()
    .from(highlights)
    .where(inArray(highlights.itemId, itemIds));

  const hltsByItem = new Map<string, Array<{ quote: string; note: string | null }>>();
  for (const h of hltRows) {
    const arr = hltsByItem.get(h.itemId) ?? [];
    arr.push({ quote: h.quote, note: h.note });
    hltsByItem.set(h.itemId, arr);
  }

  const omittedItems: Array<{ itemId: string; title: string; reason: string }> = [];
  const exportedItems: PortableExportBundle["items"] = [];

  for (const item of userItems) {
    const cnt = contentMap.get(item.id);
    exportedItems.push({
      externalId: item.id,
      type: item.type,
      title: item.title,
      originalUrl: item.originalUrl,
      summary: item.summary,
      noteText: cnt?.noteText ?? null,
      extractedText: cnt?.extractedText ?? null,
      isFavorite: item.isFavorite,
      isArchived: item.isArchived,
      tags: tagsByItem.get(item.id) ?? [],
      collections: colsByItem.get(item.id) ?? [],
      highlights: hltsByItem.get(item.id) ?? [],
      createdAt: item.createdAt.toISOString(),
    });
  }

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    manifest: {
      totalItemsExported: exportedItems.length,
      totalCollectionsExported: userCollections.length,
      totalTagsExported: userTags.length,
      omittedItems,
    },
    collections: userCollections.map((c) => ({
      name: c.name,
      description: c.description,
    })),
    items: exportedItems,
  };
}

function escapeHtmlAttr(val: string): string {
  return val
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function exportLibraryAsNetscapeHtml(bundle: PortableExportBundle): string {
  const lines: string[] = [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    "<!-- This is an automatically generated file by Comnois Knowledge Platform -->",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks Comnois</TITLE>",
    "<H1>Bookmarks Comnois</H1>",
    "<DL><p>",
  ];

  for (const item of bundle.items) {
    const href = item.originalUrl || `https://comnois.local/notes/${item.externalId}`;
    const addDate = Math.floor(new Date(item.createdAt).getTime() / 1000) || Math.floor(Date.now() / 1000);
    const tagsAttr = item.tags.length > 0 ? ` TAGS="${escapeHtmlAttr(item.tags.join(","))}"` : "";
    const folderPrefix = item.collections.length > 0 ? `[${item.collections[0]}] ` : "";
    lines.push(
      `    <DT><A HREF="${escapeHtmlAttr(href)}" ADD_DATE="${addDate}"${tagsAttr}>${escapeHtmlAttr(folderPrefix + item.title)}</A>`
    );
    const desc = item.summary || item.noteText;
    if (desc) {
      lines.push(`    <DD>${escapeHtmlAttr(desc.slice(0, 400))}`);
    }
  }

  lines.push("</DL><p>");
  return lines.join("\n");
}

function escapeCsvCell(val: string | null | undefined): string {
  const raw = String(val ?? "");
  if (raw.includes(",") || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function exportLibraryAsCsv(bundle: PortableExportBundle): string {
  const header = [
    "externalId",
    "type",
    "title",
    "originalUrl",
    "summary",
    "tags",
    "collections",
    "isFavorite",
    "isArchived",
    "createdAt",
  ].join(",");

  const rows = bundle.items.map((item) =>
    [
      escapeCsvCell(item.externalId),
      escapeCsvCell(item.type),
      escapeCsvCell(item.title),
      escapeCsvCell(item.originalUrl),
      escapeCsvCell(item.summary || item.noteText),
      escapeCsvCell(item.tags.join(";")),
      escapeCsvCell(item.collections.join(";")),
      String(item.isFavorite),
      String(item.isArchived),
      escapeCsvCell(item.createdAt),
    ].join(",")
  );

  return [header, ...rows].join("\n");
}

/**
 * Converte arquivos HTML de favoritos no padrão Netscape (Chrome, Firefox, Safari, Edge, Raindrop, Pocket, Karakeep)
 * para o formato de pacote de importação estruturado da plataforma.
 */
export function parseNetscapeBookmarksHtml(htmlContent: string): {
  formatVersion: string;
  collections: Array<{ name: string; description: string | null }>;
  items: Array<z.infer<typeof importItemSchema>>;
} {
  const $ = cheerio.load(htmlContent);
  const detectedCollections = new Set<string>();
  const parsedItems: Array<z.infer<typeof importItemSchema>> = [];

  $("a").each((_, el) => {
    const anchor = $(el);
    const href = (anchor.attr("href") || "").trim();
    if (!href || (!href.startsWith("http://") && !href.startsWith("https://"))) {
      return;
    }

    const rawTitle = anchor.text().trim() || href;
    const rawTagsAttr = anchor.attr("tags") || anchor.attr("TAGS") || "";
    const tags = rawTagsAttr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // Detect enclosing <DL> folder <H3> if present
    const folderH3 = anchor.closest("dl").prevAll("h3").first().text().trim();
    const itemCollections: string[] = [];
    if (folderH3 && !["bookmarks", "favoritos", "barra de favoritos", "bookmarks bar"].includes(folderH3.toLowerCase())) {
      detectedCollections.add(folderH3);
      itemCollections.push(folderH3);
    }

    // Detect <DD> description immediately following the <DT>
    let summary: string | null = null;
    const parentDt = anchor.closest("dt");
    const nextDd = parentDt.next("dd");
    if (nextDd.length > 0) {
      summary = nextDd.text().trim().slice(0, 1000) || null;
    }

    parsedItems.push({
      type: "link",
      title: rawTitle.slice(0, 300),
      originalUrl: href,
      summary,
      noteText: null,
      extractedText: summary,
      isFavorite: false,
      isArchived: false,
      tags,
      collections: itemCollections,
      highlights: [],
    });
  });

  return {
    formatVersion: "netscape-bookmarks-v1",
    collections: Array.from(detectedCollections).map((name) => ({
      name,
      description: "Coleção importada de favoritos HTML",
    })),
    items: parsedItems,
  };
}

const importItemSchema = z.object({
  type: z.enum(["link", "note", "file", "image"]).default("link"),
  title: z.string().trim().min(1).max(300),
  originalUrl: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  noteText: z.string().nullable().optional(),
  extractedText: z.string().nullable().optional(),
  isFavorite: z.boolean().optional().default(false),
  isArchived: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  collections: z.array(z.string()).optional().default([]),
  highlights: z
    .array(
      z.object({
        quote: z.string(),
        note: z.string().nullable().optional(),
      })
    )
    .optional()
    .default([]),
});

const importBundleSchema = z.object({
  formatVersion: z.string().optional(),
  collections: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().nullable().optional(),
      })
    )
    .optional()
    .default([]),
  items: z.array(z.unknown()),
});

export type DuplicatePolicy = "skip" | "overwrite" | "append";

export interface ImportReport {
  totalReceived: number;
  createdCount: number;
  duplicateCount: number;
  overwrittenCount: number;
  skippedCount: number;
  failedCount: number;
  failures: Array<{ index: number; title?: string; reason: string }>;
}

export interface ImportPreviewReport {
  formatDetected: "comnois-json" | "netscape-html";
  totalReceived: number;
  validItemsCount: number;
  newItemsCount: number;
  existingDuplicatesCount: number;
  collectionsDetected: string[];
  sampleTitles: string[];
}

function normalizeRawImportInput(rawPayload: unknown): unknown {
  if (typeof rawPayload === "string") {
    const trimmed = rawPayload.trim();
    if (
      trimmed.startsWith("<!DOCTYPE NETSCAPE-Bookmark-file") ||
      trimmed.toLowerCase().includes("<dl>") ||
      trimmed.toLowerCase().includes("<dt><a")
    ) {
      return parseNetscapeBookmarksHtml(trimmed);
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      throw new ValidationError(
        "Conteúdo de importação inválido. Informe um JSON comnois-export-v1 ou um arquivo HTML de favoritos Netscape."
      );
    }
  }
  return rawPayload;
}

export async function previewImportLibrary(
  ownerId: string,
  rawPayload: unknown
): Promise<ImportPreviewReport> {
  const isHtmlInput =
    typeof rawPayload === "string" &&
    (rawPayload.trim().startsWith("<!DOCTYPE NETSCAPE-Bookmark-file") ||
      rawPayload.toLowerCase().includes("<dt><a"));

  const normalizedPayload = normalizeRawImportInput(rawPayload);
  const bundleCheck = importBundleSchema.safeParse(normalizedPayload);
  if (!bundleCheck.success) {
    throw new ValidationError("Estrutura do pacote de importação inválida.");
  }

  const bundle = bundleCheck.data;
  const db = await getDb();
  const userItems = await db
    .select({
      normalizedUrl: items.normalizedUrl,
      title: items.title,
      type: items.type,
    })
    .from(items)
    .where(eq(items.ownerId, ownerId));

  const existingUrls = new Set(
    userItems.map((i) => i.normalizedUrl).filter((u): u is string => Boolean(u))
  );
  const existingTitles = new Set(userItems.map((i) => `${i.type}:${i.title}`));

  let validItemsCount = 0;
  let newItemsCount = 0;
  let existingDuplicatesCount = 0;
  const collectionsSet = new Set<string>(bundle.collections.map((c) => c.name));
  const sampleTitles: string[] = [];

  for (const rawItem of bundle.items) {
    const parsed = importItemSchema.safeParse(rawItem);
    if (!parsed.success) continue;
    validItemsCount++;

    const item = parsed.data;
    if (sampleTitles.length < 5) {
      sampleTitles.push(item.title);
    }
    for (const c of item.collections) {
      collectionsSet.add(c);
    }

    let isDup = false;
    if (item.originalUrl) {
      try {
        const norm = normalizeUrlForDeduplication(item.originalUrl);
        if (existingUrls.has(norm.normalizedUrl)) {
          isDup = true;
        }
      } catch {
        // ignore invalid url in preview
      }
    } else if (existingTitles.has(`${item.type}:${item.title}`)) {
      isDup = true;
    }

    if (isDup) {
      existingDuplicatesCount++;
    } else {
      newItemsCount++;
    }
  }

  return {
    formatDetected: isHtmlInput ? "netscape-html" : "comnois-json",
    totalReceived: bundle.items.length,
    validItemsCount,
    newItemsCount,
    existingDuplicatesCount,
    collectionsDetected: Array.from(collectionsSet),
    sampleTitles,
  };
}

export async function importUserLibrary(
  ownerId: string,
  rawPayload: unknown,
  options?: { duplicatePolicy?: DuplicatePolicy }
): Promise<ImportReport> {
  const duplicatePolicy = options?.duplicatePolicy ?? "skip";
  const normalizedPayload = normalizeRawImportInput(rawPayload);
  const bundleCheck = importBundleSchema.safeParse(normalizedPayload);

  if (!bundleCheck.success) {
    throw new ValidationError("Estrutura do arquivo de importação inválida.");
  }

  const bundle = bundleCheck.data;
  if (bundle.items.length > 500) {
    throw new ValidationError("Limite máximo de 500 itens por lote de importação excedido.");
  }

  const db = await getDb();

  // Ensure collections exist
  const collectionIdByName = new Map<string, string>();
  const existingCols = await db
    .select()
    .from(collections)
    .where(eq(collections.ownerId, ownerId));

  for (const col of existingCols) {
    collectionIdByName.set(normalizeSearchText(col.name), col.id);
  }

  for (const colDef of bundle.collections) {
    const cleanName = colDef.name.trim();
    const norm = normalizeSearchText(cleanName);
    if (!norm || collectionIdByName.has(norm)) continue;
    const newColId = generateId("col");
    await db.insert(collections).values({
      id: newColId,
      ownerId,
      name: cleanName,
      description: colDef.description ?? null,
      type: "manual",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    collectionIdByName.set(norm, newColId);
  }

  let createdCount = 0;
  let duplicateCount = 0;
  let overwrittenCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failures: Array<{ index: number; title?: string; reason: string }> = [];

  for (let i = 0; i < bundle.items.length; i++) {
    const rawItem = bundle.items[i];
    const parsedItem = importItemSchema.safeParse(rawItem);

    if (!parsedItem.success) {
      failedCount++;
      failures.push({
        index: i,
        reason: parsedItem.error.issues[0]?.message ?? "Item inválido.",
      });
      continue;
    }

    const itemData = parsedItem.data;

    try {
      let normalizedUrl: string | null = null;
      let domain: string | null = null;

      if (itemData.originalUrl) {
        const normInfo = normalizeUrlForDeduplication(itemData.originalUrl);
        normalizedUrl = normInfo.normalizedUrl;
        domain = normInfo.domain;
      }

      // Check existing duplicate by normalizedUrl (for links) or exact title + noteText (for notes)
      let existingMatch: typeof items.$inferSelect | undefined;
      if (normalizedUrl) {
        const [found] = await db
          .select()
          .from(items)
          .where(
            and(
              eq(items.ownerId, ownerId),
              eq(items.normalizedUrl, normalizedUrl)
            )
          )
          .limit(1);
        existingMatch = found;
      } else {
        const [found] = await db
          .select()
          .from(items)
          .where(
            and(
              eq(items.ownerId, ownerId),
              eq(items.type, itemData.type),
              eq(items.title, itemData.title)
            )
          )
          .limit(1);
        existingMatch = found;
      }

      if (existingMatch && duplicatePolicy === "skip") {
        duplicateCount++;
        skippedCount++;
        continue;
      }

      let targetItemId = generateId("itm");
      const now = new Date();
      const safeNote = itemData.noteText
        ? sanitizeHtmlContent(itemData.noteText)
        : null;
      const safeExtracted = itemData.extractedText
        ? sanitizeHtmlContent(itemData.extractedText)
        : null;

      if (existingMatch && duplicatePolicy === "overwrite") {
        duplicateCount++;
        overwrittenCount++;
        targetItemId = existingMatch.id;
        const nextVer = existingMatch.contentVersion + 1;

        await db
          .update(items)
          .set({
            title: itemData.title,
            summary: itemData.summary ?? existingMatch.summary,
            isFavorite: itemData.isFavorite,
            isArchived: itemData.isArchived,
            contentVersion: nextVer,
            processingStatus: "completed",
            updatedAt: now,
          })
          .where(eq(items.id, targetItemId));

        await db
          .delete(itemContents)
          .where(eq(itemContents.itemId, targetItemId));

        await db.insert(itemContents).values({
          id: generateId("cnt"),
          itemId: targetItemId,
          noteText: safeNote,
          extractedText: safeExtracted || safeNote || itemData.summary || "",
          language: "pt",
          extractionOrigin: "import",
          extractorVersion: "1.0.0",
          contentHash: sha256Hex(safeExtracted || safeNote || itemData.title),
          contentVersion: nextVer,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        if (existingMatch) {
          duplicateCount++;
        }
        createdCount++;

        await db.insert(items).values({
          id: targetItemId,
          ownerId,
          type: itemData.type,
          title: itemData.title,
          originalUrl: itemData.originalUrl ?? null,
          normalizedUrl,
          domain,
          summary: itemData.summary ?? null,
          summarySource: itemData.summary ? "manual" : null,
          metadata: { importedAt: now.toISOString() },
          processingStatus: "completed",
          isFavorite: itemData.isFavorite,
          isArchived: itemData.isArchived,
          contentVersion: 1,
          importSource: EXPORT_FORMAT_VERSION,
          createdAt: now,
          updatedAt: now,
        });

        await db.insert(itemContents).values({
          id: generateId("cnt"),
          itemId: targetItemId,
          noteText: safeNote,
          extractedText: safeExtracted || safeNote || itemData.summary || "",
          language: "pt",
          extractionOrigin: "import",
          extractorVersion: "1.0.0",
          contentHash: sha256Hex(safeExtracted || safeNote || itemData.title),
          contentVersion: 1,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Assign tags
      if (itemData.tags.length > 0) {
        await assignTagsToItem({
          ownerId,
          itemId: targetItemId,
          tagNames: itemData.tags,
          source: "manual",
        });
      }

      // Assign collections
      for (const colName of itemData.collections) {
        const cleanCol = colName.trim();
        const normCol = normalizeSearchText(cleanCol);
        if (!normCol) continue;

        let colId = collectionIdByName.get(normCol);
        if (!colId) {
          colId = generateId("col");
          await db.insert(collections).values({
            id: colId,
            ownerId,
            name: cleanCol,
            type: "manual",
            createdAt: now,
            updatedAt: now,
          });
          collectionIdByName.set(normCol, colId);
        }

        const [existingColAssoc] = await db
          .select()
          .from(collectionItems)
          .where(
            and(
              eq(collectionItems.collectionId, colId),
              eq(collectionItems.itemId, targetItemId)
            )
          )
          .limit(1);

        if (!existingColAssoc) {
          await db.insert(collectionItems).values({
            id: generateId("ci"),
            collectionId: colId,
            itemId: targetItemId,
            createdAt: now,
          });
        }
      }

      // Highlights
      for (const h of itemData.highlights) {
        if (!h.quote.trim()) continue;
        await db.insert(highlights).values({
          id: generateId("hlt"),
          itemId: targetItemId,
          ownerId,
          quote: h.quote.trim(),
          note: h.note ?? null,
          createdAt: now,
        });
      }

      await indexItemContent(targetItemId, { generateEmbeddings: true });
    } catch (err) {
      failedCount++;
      failures.push({
        index: i,
        title: itemData.title,
        reason: err instanceof Error ? err.message : "Erro ao importar item.",
      });
    }
  }

  return {
    totalReceived: bundle.items.length,
    createdCount,
    duplicateCount,
    overwrittenCount,
    skippedCount,
    failedCount,
    failures,
  };
}

