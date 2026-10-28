import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  items,
  itemContents,
  documentChunks,
  embeddings,
  itemTags,
  tags,
  collections,
  collectionItems,
} from "@/db/schema";
import {
  evaluateSmartCollectionItemIds,
  SmartCollectionRules,
} from "@/server/services/organization";
import {
  CHUNKER_VERSION,
  normalizeSearchText,
  splitTextIntoChunks,
} from "./chunker";
import { parseSearchQueryDsl } from "./query-dsl";
import {
  checkAndRecordAiUsage,
  cosineSimilarity,
  resolveAiProviderForUser,
} from "@/server/ai/providers";
import { requireWorkspaceRole } from "@/server/services/workspaces";
import { generateId } from "@/lib/security/crypto";
import { logger } from "@/lib/logger";

export async function removeItemFromSearchIndex(itemId: string): Promise<void> {
  const db = await getDb();
  await db.delete(embeddings).where(eq(embeddings.itemId, itemId));
  await db.delete(documentChunks).where(eq(documentChunks.itemId, itemId));
}

export async function indexItemContent(
  itemId: string,
  options?: { generateEmbeddings?: boolean; expectedContentVersion?: number }
): Promise<{ chunksCreated: number; embeddingsCreated: number; skipped?: boolean }> {
  const db = await getDb();

  // Always re-read current state from database (do not trust stale queue payloads)
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);

  if (!item) {
    logger.warn("search.index_skipped_deleted_item", { itemId });
    await removeItemFromSearchIndex(itemId);
    return { chunksCreated: 0, embeddingsCreated: 0, skipped: true };
  }

  if (
    options?.expectedContentVersion !== undefined &&
    item.contentVersion > options.expectedContentVersion
  ) {
    logger.info("search.index_skipped_stale_version", {
      itemId,
      currentVersion: item.contentVersion,
      expectedVersion: options.expectedContentVersion,
    });
    return { chunksCreated: 0, embeddingsCreated: 0, skipped: true };
  }

  const [contentRow] = await db
    .select()
    .from(itemContents)
    .where(eq(itemContents.itemId, itemId))
    .limit(1);

  const bodyParts = [
    item.title,
    item.summary ?? "",
    contentRow?.noteText ?? "",
    contentRow?.extractedText ?? "",
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  const combinedText = bodyParts.join("\n\n");
  const chunkDescriptors = splitTextIntoChunks(combinedText);

  // Replace existing derived chunks and embeddings idempotently
  await db.delete(embeddings).where(eq(embeddings.itemId, itemId));
  await db.delete(documentChunks).where(eq(documentChunks.itemId, itemId));

  const insertedChunks: Array<{ id: string; text: string; textHash: string }> = [];

  for (const desc of chunkDescriptors) {
    const chunkId = generateId("chk");
    await db.insert(documentChunks).values({
      id: chunkId,
      itemId: item.id,
      ownerId: item.ownerId,
      workspaceId: item.workspaceId,
      chunkIndex: desc.chunkIndex,
      text: desc.text,
      normalizedText: desc.normalizedText,
      startOffset: desc.startOffset,
      endOffset: desc.endOffset,
      locator: desc.locator,
      textHash: desc.textHash,
      contentVersion: item.contentVersion,
      chunkerVersion: CHUNKER_VERSION,
      createdAt: new Date(),
    });
    insertedChunks.push({ id: chunkId, text: desc.text, textHash: desc.textHash });
  }

  let embeddingsCreated = 0;
  if (options?.generateEmbeddings !== false && insertedChunks.length > 0) {
    try {
      const provider = await resolveAiProviderForUser(item.ownerId);
      const caps = provider.getCapabilities();
      if (caps.supportsEmbeddings) {
        for (const chk of insertedChunks) {
          const { vector, tokensUsed } = await provider.generateEmbedding(chk.text);
          if (vector.length !== caps.embeddingDimensions) {
            throw new Error(
              `Dimensão de embedding incompatível: esperado ${caps.embeddingDimensions}, recebido ${vector.length}`
            );
          }
          await checkAndRecordAiUsage({
            ownerId: item.ownerId,
            provider: caps.provider,
            model: caps.modelVersion,
            operation: "embedding",
            inputTokens: tokensUsed,
            outputTokens: 0,
          });
          await db.insert(embeddings).values({
            id: generateId("emb"),
            chunkId: chk.id,
            itemId: item.id,
            ownerId: item.ownerId,
            workspaceId: item.workspaceId,
            provider: caps.provider,
            modelVersion: caps.modelVersion,
            dimensions: caps.embeddingDimensions,
            vectorJson: vector,
            textHash: chk.textHash,
            createdAt: new Date(),
          });
          embeddingsCreated++;
        }
      }
    } catch (err) {
      logger.warn("search.embedding_generation_skipped", {
        itemId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    chunksCreated: insertedChunks.length,
    embeddingsCreated,
  };
}

export async function reindexUserLibrary(
  ownerId: string,
  options?: { regenerateEmbeddings?: boolean }
): Promise<{ itemsIndexed: number; chunksCreated: number; embeddingsCreated: number }> {
  const db = await getDb();
  const userItems = await db.select({ id: items.id }).from(items).where(eq(items.ownerId, ownerId));

  let chunksCreated = 0;
  let embeddingsCreated = 0;

  for (const row of userItems) {
    const res = await indexItemContent(row.id, {
      generateEmbeddings: options?.regenerateEmbeddings ?? true,
    });
    chunksCreated += res.chunksCreated;
    embeddingsCreated += res.embeddingsCreated;
  }

  return {
    itemsIndexed: userItems.length,
    chunksCreated,
    embeddingsCreated,
  };
}

export interface SearchFilters {
  ownerId: string;
  workspaceId?: string | null;
  query?: string;
  mode?: "lexical" | "semantic" | "hybrid";
  type?: "link" | "note" | "file" | "image";
  tagIds?: string[];
  tagMatchMode?: "and" | "or";
  collectionId?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  includeArchived?: boolean;
  processingStatus?: "pending" | "processing" | "completed" | "partial" | "failed" | "cancelled";
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: "newest" | "oldest" | "updated" | "relevance";
  page?: number;
  pageSize?: number;
}

export interface SearchResultItem {
  id: string;
  type: "link" | "note" | "file" | "image";
  title: string;
  originalUrl: string | null;
  domain: string | null;
  summary: string | null;
  processingStatus: string;
  processingError: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ id: string; name: string; source: string }>;
  snippet?: string;
  score: number;
  lexicalScore?: number;
  semanticScore?: number;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  page: number;
  pageSize: number;
  requestedMode: "lexical" | "semantic" | "hybrid";
  effectiveMode: "lexical" | "semantic" | "hybrid";
  fallbackReason?: string;
}

export function computeLexicalScore(
  queryNorm: string,
  queryTerms: string[],
  fields: {
    title: string;
    domain: string;
    summary: string;
    tagsText: string;
    chunksText: string;
  }
): { score: number; matchedSnippet?: string } {
  if (!queryNorm || queryTerms.length === 0) {
    return { score: 0 };
  }

  const titleNorm = normalizeSearchText(fields.title);
  const domainNorm = normalizeSearchText(fields.domain);
  const summaryNorm = normalizeSearchText(fields.summary);
  const tagsNorm = normalizeSearchText(fields.tagsText);
  const bodyNorm = normalizeSearchText(fields.chunksText);

  let score = 0;
  let matchedTermsCount = 0;

  // Exact phrase boost
  if (titleNorm.includes(queryNorm)) score += 12;
  if (tagsNorm.includes(queryNorm)) score += 9;
  if (domainNorm.includes(queryNorm)) score += 7;
  if (summaryNorm.includes(queryNorm)) score += 6;
  if (bodyNorm.includes(queryNorm)) score += 5;

  for (const term of queryTerms) {
    let termFound = false;
    if (titleNorm.includes(term)) {
      score += 5;
      termFound = true;
    }
    if (tagsNorm.includes(term)) {
      score += 4;
      termFound = true;
    }
    if (domainNorm.includes(term)) {
      score += 3;
      termFound = true;
    }
    if (summaryNorm.includes(term)) {
      score += 2.5;
      termFound = true;
    }
    if (bodyNorm.includes(term)) {
      score += 1.5;
      termFound = true;
    }
    if (termFound) {
      matchedTermsCount++;
    }
  }

  // Require at least one term match in lexical mode
  if (matchedTermsCount === 0) {
    return { score: 0 };
  }

  // Coverage bonus when all query terms appear
  if (matchedTermsCount === queryTerms.length) {
    score *= 1.35;
  }

  return { score: Number(score.toFixed(4)) };
}

export async function searchLibrary(filters: SearchFilters): Promise<SearchResponse> {
  const db = await getDb();

  // Verify authorization on workspace if workspaceId is specified
  if (filters.workspaceId) {
    await requireWorkspaceRole(filters.ownerId, filters.workspaceId, "member");
  }

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const requestedMode = filters.mode ?? "lexical";
  const parsedDsl = parseSearchQueryDsl(filters.query ?? "");
  const rawQuery = parsedDsl.cleanQuery;
  const queryNorm = normalizeSearchText(rawQuery);
  const queryTerms = queryNorm.split(/\s+/).filter((t) => t.length >= 2);

  const effectiveType = filters.type ?? parsedDsl.type;
  const effectiveFavorite =
    filters.isFavorite !== undefined ? filters.isFavorite : parsedDsl.isFavorite;
  const effectiveArchived =
    filters.isArchived !== undefined ? filters.isArchived : parsedDsl.isArchived;
  const effectiveStatus = filters.processingStatus ?? parsedDsl.processingStatus;
  const effectiveDateFrom = filters.dateFrom ?? parsedDsl.dateFrom;
  const effectiveDateTo = filters.dateTo ?? parsedDsl.dateTo;
  const effectiveDomainContains = parsedDsl.domainContains;

  // Load candidate items strictly scoped to the authorized owner or workspace
  const candidateItems = await db
    .select()
    .from(items)
    .where(
      filters.workspaceId
        ? eq(items.workspaceId, filters.workspaceId)
        : eq(items.ownerId, filters.ownerId)
    );

  if (candidateItems.length === 0) {
    return {
      results: [],
      total: 0,
      page,
      pageSize,
      requestedMode,
      effectiveMode: requestedMode,
    };
  }

  const candidateIds = candidateItems.map((i) => i.id);

  // Load tags for candidates
  const itemTagRows = await db
    .select({
      itemId: itemTags.itemId,
      tagId: tags.id,
      tagName: tags.name,
      source: itemTags.source,
    })
    .from(itemTags)
    .innerJoin(tags, eq(itemTags.tagId, tags.id))
    .where(inArray(itemTags.itemId, candidateIds));

  const tagsByItem = new Map<string, Array<{ id: string; name: string; source: string }>>();
  for (const row of itemTagRows) {
    const arr = tagsByItem.get(row.itemId) ?? [];
    arr.push({ id: row.tagId, name: row.tagName, source: row.source });
    tagsByItem.set(row.itemId, arr);
  }

  // Load collection memberships if collectionId filter is active (supports both manual and smart collections)
  let allowedByCollection: Set<string> | null = null;
  if (filters.collectionId) {
    const [colDef] = await db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.id, filters.collectionId),
          eq(collections.ownerId, filters.ownerId)
        )
      )
      .limit(1);

    if (colDef && colDef.type === "smart" && colDef.smartRules) {
      const smartMatchedIds = await evaluateSmartCollectionItemIds(
        filters.ownerId,
        colDef.smartRules as SmartCollectionRules
      );
      allowedByCollection = new Set(smartMatchedIds);
    } else {
      const colRows = await db
        .select({ itemId: collectionItems.itemId })
        .from(collectionItems)
        .where(eq(collectionItems.collectionId, filters.collectionId));
      allowedByCollection = new Set(colRows.map((r) => r.itemId));
    }
  }

  // Apply structured metadata filters deterministically (including inline Query DSL modifiers)
  const filteredItems = candidateItems.filter((item) => {
    if (effectiveType && item.type !== effectiveType) return false;
    if (effectiveFavorite !== undefined && item.isFavorite !== effectiveFavorite) return false;

    if (effectiveArchived !== undefined) {
      if (item.isArchived !== effectiveArchived) return false;
    } else if (!filters.includeArchived) {
      if (item.isArchived) return false;
    }

    if (effectiveStatus && item.processingStatus !== effectiveStatus) {
      return false;
    }

    if (effectiveDomainContains) {
      if (!(item.domain ?? "").toLowerCase().includes(effectiveDomainContains.toLowerCase())) {
        return false;
      }
    }

    if (effectiveDateFrom && item.createdAt < effectiveDateFrom) return false;
    if (effectiveDateTo && item.createdAt > effectiveDateTo) return false;

    if (allowedByCollection && !allowedByCollection.has(item.id)) return false;

    if (parsedDsl.tagNames.length > 0) {
      const assignedNormNames = new Set(
        (tagsByItem.get(item.id) ?? []).map((t) => normalizeSearchText(t.name))
      );
      if (!parsedDsl.tagNames.every((tn) => assignedNormNames.has(tn))) {
        return false;
      }
    }

    if (filters.tagIds && filters.tagIds.length > 0) {
      const assignedIds = new Set((tagsByItem.get(item.id) ?? []).map((t) => t.id));
      if (filters.tagMatchMode === "or") {
        if (!filters.tagIds.some((tid) => assignedIds.has(tid))) return false;
      } else {
        if (!filters.tagIds.every((tid) => assignedIds.has(tid))) return false;
      }
    }

    return true;
  });

  if (filteredItems.length === 0) {
    return {
      results: [],
      total: 0,
      page,
      pageSize,
      requestedMode,
      effectiveMode: requestedMode,
    };
  }

  const filteredIds = filteredItems.map((i) => i.id);

  // If there is no search query, sort and paginate directly
  if (!queryNorm) {
    const sortBy =
      filters.sortBy === "relevance" || !filters.sortBy ? "newest" : filters.sortBy;

    const sorted = [...filteredItems].sort((a, b) => {
      if (sortBy === "oldest") {
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }
      if (sortBy === "updated") {
        const diff = b.updatedAt.getTime() - a.updatedAt.getTime();
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }
      const diff = b.createdAt.getTime() - a.createdAt.getTime();
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });

    const start = (page - 1) * pageSize;
    const sliced = sorted.slice(start, start + pageSize);

    return {
      results: sliced.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        originalUrl: item.originalUrl,
        domain: item.domain,
        summary: item.summary,
        processingStatus: item.processingStatus,
        processingError: item.processingError,
        isFavorite: item.isFavorite,
        isArchived: item.isArchived,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        tags: tagsByItem.get(item.id) ?? [],
        score: 1,
      })),
      total: sorted.length,
      page,
      pageSize,
      requestedMode,
      effectiveMode: "lexical",
    };
  }

  // Load chunks and contents for filtered items
  const chunkRows = await db
    .select()
    .from(documentChunks)
    .where(inArray(documentChunks.itemId, filteredIds));

  const contentRows = await db
    .select()
    .from(itemContents)
    .where(inArray(itemContents.itemId, filteredIds));

  const chunksByItem = new Map<string, typeof chunkRows>();
  for (const c of chunkRows) {
    const list = chunksByItem.get(c.itemId) ?? [];
    list.push(c);
    chunksByItem.set(c.itemId, list);
  }

  const contentByItem = new Map<string, (typeof contentRows)[0]>();
  for (const c of contentRows) {
    contentByItem.set(c.itemId, c);
  }

  // 1. Lexical ranking
  const lexicalByItem = new Map<string, { score: number; snippet: string }>();
  for (const item of filteredItems) {
    const itemChunks = chunksByItem.get(item.id) ?? [];
    const content = contentByItem.get(item.id);
    const itemTagsList = tagsByItem.get(item.id) ?? [];
    const chunksText =
      itemChunks.length > 0
        ? itemChunks.map((c) => c.text).join("\n")
        : [content?.noteText ?? "", content?.extractedText ?? ""].join("\n");

    const { score } = computeLexicalScore(queryNorm, queryTerms, {
      title: item.title,
      domain: item.domain ?? "",
      summary: item.summary ?? "",
      tagsText: itemTagsList.map((t) => t.name).join(" "),
      chunksText,
    });

    if (score > 0) {
      let bestSnippet = item.summary ?? chunksText.slice(0, 220);
      for (const chk of itemChunks) {
        if (queryTerms.some((term) => chk.normalizedText.includes(term))) {
          bestSnippet = chk.text.slice(0, 240);
          break;
        }
      }
      lexicalByItem.set(item.id, { score, snippet: bestSnippet });
    }
  }

  // 2. Semantic ranking (when mode is semantic or hybrid)
  let effectiveMode: "lexical" | "semantic" | "hybrid" = requestedMode;
  let fallbackReason: string | undefined;
  const semanticByItem = new Map<string, { score: number; snippet: string }>();

  if (requestedMode === "semantic" || requestedMode === "hybrid") {
    try {
      const provider = await resolveAiProviderForUser(filters.ownerId);
      const caps = provider.getCapabilities();
      if (!caps.supportsEmbeddings) {
        throw new Error("O provedor selecionado não suporta geração de embeddings.");
      }

      const { vector: queryVector } = await provider.generateEmbedding(rawQuery);
      const embRows = await db
        .select()
        .from(embeddings)
        .where(
          and(
            inArray(embeddings.itemId, filteredIds),
            eq(embeddings.modelVersion, caps.modelVersion)
          )
        );

      if (embRows.length === 0) {
        if (requestedMode === "hybrid") {
          effectiveMode = "lexical";
          fallbackReason =
            "Nenhum vetor compatível com o modelo atual encontrado; utilizando busca textual.";
        }
      } else {
        const chunkMap = new Map(chunkRows.map((c) => [c.id, c]));
        for (const emb of embRows) {
          const sim = cosineSimilarity(queryVector, emb.vectorJson);
          if (sim >= 0.12) {
            const existing = semanticByItem.get(emb.itemId);
            if (!existing || sim > existing.score) {
              const chk = chunkMap.get(emb.chunkId);
              semanticByItem.set(emb.itemId, {
                score: Number(sim.toFixed(4)),
                snippet: chk?.text.slice(0, 240) ?? "",
              });
            }
          }
        }
      }
    } catch (err) {
      effectiveMode = "lexical";
      fallbackReason =
        err instanceof Error
          ? err.message
          : "Infraestrutura semântica indisponível; utilizando fallback textual.";
    }
  }

  // 3. Combine results according to effectiveMode
  const scoredItems: Array<{
    item: (typeof filteredItems)[0];
    score: number;
    lexicalScore?: number;
    semanticScore?: number;
    snippet: string;
  }> = [];

  if (effectiveMode === "lexical") {
    for (const item of filteredItems) {
      const lex = lexicalByItem.get(item.id);
      if (lex) {
        scoredItems.push({
          item,
          score: lex.score,
          lexicalScore: lex.score,
          snippet: lex.snippet,
        });
      }
    }
  } else if (effectiveMode === "semantic") {
    for (const item of filteredItems) {
      const sem = semanticByItem.get(item.id);
      if (sem) {
        scoredItems.push({
          item,
          score: sem.score,
          semanticScore: sem.score,
          snippet: sem.snippet || (item.summary ?? ""),
        });
      }
    }
  } else {
    // Hybrid mode: Reciprocal Rank Fusion (RRF, k = 60)
    const RRF_K = 60;
    const lexRanked = [...lexicalByItem.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .map(([id], idx) => [id, idx + 1] as const);
    const semRanked = [...semanticByItem.entries()]
      .sort((a, b) => b[1].score - a[1].score)
      .map(([id], idx) => [id, idx + 1] as const);

    const lexRankMap = new Map(lexRanked);
    const semRankMap = new Map(semRanked);

    for (const item of filteredItems) {
      const lRank = lexRankMap.get(item.id);
      const sRank = semRankMap.get(item.id);
      if (!lRank && !sRank) continue;

      const rrfScore =
        (lRank ? 1 / (RRF_K + lRank) : 0) + (sRank ? 1 / (RRF_K + sRank) : 0);

      const lexInfo = lexicalByItem.get(item.id);
      const semInfo = semanticByItem.get(item.id);

      scoredItems.push({
        item,
        score: Number(rrfScore.toFixed(6)),
        lexicalScore: lexInfo?.score,
        semanticScore: semInfo?.score,
        snippet: lexInfo?.snippet || semInfo?.snippet || item.summary || "",
      });
    }
  }

  const sortBy = filters.sortBy ?? "relevance";
  scoredItems.sort((a, b) => {
    if (sortBy === "newest") {
      const diff = b.item.createdAt.getTime() - a.item.createdAt.getTime();
      return diff !== 0 ? diff : a.item.id.localeCompare(b.item.id);
    }
    if (sortBy === "oldest") {
      const diff = a.item.createdAt.getTime() - b.item.createdAt.getTime();
      return diff !== 0 ? diff : a.item.id.localeCompare(b.item.id);
    }
    if (sortBy === "updated") {
      const diff = b.item.updatedAt.getTime() - a.item.updatedAt.getTime();
      return diff !== 0 ? diff : a.item.id.localeCompare(b.item.id);
    }
    // Default: relevance with deterministic tie-breaker
    if (b.score !== a.score) return b.score - a.score;
    const timeDiff = b.item.createdAt.getTime() - a.item.createdAt.getTime();
    return timeDiff !== 0 ? timeDiff : a.item.id.localeCompare(b.item.id);
  });

  const start = (page - 1) * pageSize;
  const pageSlice = scoredItems.slice(start, start + pageSize);

  return {
    results: pageSlice.map((entry) => ({
      id: entry.item.id,
      type: entry.item.type,
      title: entry.item.title,
      originalUrl: entry.item.originalUrl,
      domain: entry.item.domain,
      summary: entry.item.summary,
      processingStatus: entry.item.processingStatus,
      processingError: entry.item.processingError,
      isFavorite: entry.item.isFavorite,
      isArchived: entry.item.isArchived,
      createdAt: entry.item.createdAt,
      updatedAt: entry.item.updatedAt,
      tags: tagsByItem.get(entry.item.id) ?? [],
      snippet: entry.snippet,
      score: entry.score,
      lexicalScore: entry.lexicalScore,
      semanticScore: entry.semanticScore,
    })),
    total: scoredItems.length,
    page,
    pageSize,
    requestedMode,
    effectiveMode,
    fallbackReason,
  };
}

