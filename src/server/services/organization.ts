import { eq, and, sql, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  items,
  tags,
  itemTags,
  collections,
  collectionItems,
  highlights,
  automationRules,
} from "@/db/schema";
import { generateId } from "@/lib/security/crypto";
import { normalizeSearchText } from "@/server/search/chunker";
import { assertItemAccess } from "./items";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/errors";

// ============================================================================
// TAGS
// ============================================================================

export async function listUserTags(ownerId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      normalizedName: tags.normalizedName,
      createdAt: tags.createdAt,
      itemCount: sql<number>`count(${itemTags.id})`,
    })
    .from(tags)
    .leftJoin(itemTags, eq(tags.id, itemTags.tagId))
    .where(eq(tags.ownerId, ownerId))
    .groupBy(tags.id);

  return rows.map((r) => ({
    ...r,
    itemCount: Number(r.itemCount ?? 0),
  }));
}

export async function renameTag(ownerId: string, tagId: string, newName: string) {
  const clean = newName.trim();
  const norm = normalizeSearchText(clean);
  if (!norm) {
    throw new ValidationError("Nome da etiqueta inválido.");
  }

  const db = await getDb();
  const [tag] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
  if (!tag) throw new NotFoundError("Etiqueta não encontrada.");
  if (tag.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  const [conflict] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.ownerId, ownerId), eq(tags.normalizedName, norm)))
    .limit(1);

  if (conflict && conflict.id !== tagId) {
    throw new ConflictError("Já existe outra etiqueta com este nome.");
  }

  await db
    .update(tags)
    .set({ name: clean, normalizedName: norm })
    .where(eq(tags.id, tagId));

  const [updated] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
  return updated;
}

export async function deleteTag(ownerId: string, tagId: string): Promise<void> {
  const db = await getDb();
  const [tag] = await db.select().from(tags).where(eq(tags.id, tagId)).limit(1);
  if (!tag) throw new NotFoundError("Etiqueta não encontrada.");
  if (tag.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  // Deleting a tag only deletes the tag and item_tags join rows, NOT the items!
  await db.delete(tags).where(eq(tags.id, tagId));
}

export async function confirmOrRejectItemTag(input: {
  ownerId: string;
  itemId: string;
  tagId: string;
  decision: "confirm" | "reject";
}): Promise<void> {
  await assertItemAccess(input.ownerId, input.itemId);
  const db = await getDb();

  if (input.decision === "reject") {
    await db
      .delete(itemTags)
      .where(
        and(eq(itemTags.itemId, input.itemId), eq(itemTags.tagId, input.tagId))
      );
    return;
  }

  await db
    .update(itemTags)
    .set({
      isConfirmed: true,
      source: "manual",
    })
    .where(
      and(eq(itemTags.itemId, input.itemId), eq(itemTags.tagId, input.tagId))
    );
}

// ============================================================================
// COLLECTIONS (MANUAL & SMART)
// ============================================================================

export interface SmartCollectionRules {
  itemType?: "link" | "note" | "file" | "image";
  domainContains?: string;
  titleContains?: string;
  tagName?: string;
  isFavorite?: boolean;
}

export async function evaluateSmartCollectionItemIds(
  ownerId: string,
  rules: SmartCollectionRules
): Promise<string[]> {
  const db = await getDb();
  const userItems = await db
    .select()
    .from(items)
    .where(and(eq(items.ownerId, ownerId), eq(items.isArchived, false)));

  if (userItems.length === 0) return [];

  let allowedByTag: Set<string> | null = null;
  if (rules.tagName && rules.tagName.trim()) {
    const normTag = normalizeSearchText(rules.tagName.trim());
    const itemIds = userItems.map((i) => i.id);
    const rows = await db
      .select({ itemId: itemTags.itemId, normalizedName: tags.normalizedName })
      .from(itemTags)
      .innerJoin(tags, eq(itemTags.tagId, tags.id))
      .where(inArray(itemTags.itemId, itemIds));

    allowedByTag = new Set(
      rows.filter((r) => r.normalizedName === normTag).map((r) => r.itemId)
    );
  }

  return userItems
    .filter((item) => {
      if (rules.itemType && item.type !== rules.itemType) return false;
      if (rules.isFavorite !== undefined && item.isFavorite !== rules.isFavorite) {
        return false;
      }
      if (
        rules.domainContains &&
        !(item.domain ?? "")
          .toLowerCase()
          .includes(rules.domainContains.toLowerCase())
      ) {
        return false;
      }
      if (
        rules.titleContains &&
        !normalizeSearchText(item.title).includes(
          normalizeSearchText(rules.titleContains)
        )
      ) {
        return false;
      }
      if (allowedByTag && !allowedByTag.has(item.id)) {
        return false;
      }
      return true;
    })
    .map((i) => i.id);
}

export async function assertNoCollectionCycle(
  ownerId: string,
  collectionId: string,
  targetParentId: string | null | undefined
): Promise<void> {
  if (!targetParentId) return;
  if (targetParentId === collectionId) {
    throw new ValidationError("Uma coleção não pode ser subcoleção de si mesma (ciclo detectado).");
  }

  const db = await getDb();
  const userCollections = await db
    .select({ id: collections.id, parentId: collections.parentId })
    .from(collections)
    .where(eq(collections.ownerId, ownerId));

  const parentMap = new Map<string, string | null>();
  for (const c of userCollections) {
    parentMap.set(c.id, c.parentId ?? null);
  }

  if (!parentMap.has(targetParentId)) {
    throw new NotFoundError("Coleção pai de destino não encontrada.");
  }

  let cursor: string | null = targetParentId;
  const visited = new Set<string>([collectionId]);

  while (cursor) {
    if (visited.has(cursor)) {
      throw new ValidationError(
        "Operação bloqueada: mover esta coleção para dentro de uma subcoleção descendente criaria um ciclo hierárquico."
      );
    }
    visited.add(cursor);
    cursor = parentMap.get(cursor) ?? null;
  }
}

export async function createCollection(input: {
  ownerId: string;
  name: string;
  description?: string;
  parentId?: string | null;
  type?: "manual" | "smart";
  smartRules?: SmartCollectionRules;
}) {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new ValidationError("Informe um nome para a coleção.");
  }

  const colType = input.type ?? "manual";
  if (colType === "smart" && (!input.smartRules || Object.keys(input.smartRules).length === 0)) {
    throw new ValidationError(
      "Coleções inteligentes exigem pelo menos uma regra estruturada."
    );
  }

  const db = await getDb();
  if (input.parentId) {
    const [parentCol] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, input.parentId), eq(collections.ownerId, input.ownerId)))
      .limit(1);
    if (!parentCol) {
      throw new NotFoundError("Coleção pai não encontrada.");
    }
  }

  const id = generateId("col");
  const now = new Date();

  await db.insert(collections).values({
    id,
    ownerId: input.ownerId,
    parentId: input.parentId ?? null,
    name: cleanName,
    description: input.description?.trim() ?? null,
    type: colType,
    smartRules: colType === "smart" ? (input.smartRules as Record<string, unknown>) : null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, id))
    .limit(1);
  return created;
}

export async function listUserCollections(ownerId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: collections.id,
      parentId: collections.parentId,
      name: collections.name,
      description: collections.description,
      type: collections.type,
      smartRules: collections.smartRules,
      createdAt: collections.createdAt,
      updatedAt: collections.updatedAt,
      itemCount: sql<number>`count(${collectionItems.id})`,
    })
    .from(collections)
    .leftJoin(collectionItems, eq(collections.id, collectionItems.collectionId))
    .where(eq(collections.ownerId, ownerId))
    .groupBy(collections.id);

  const results = [];
  for (const r of rows) {
    if (r.type === "smart" && r.smartRules) {
      const matchedIds = await evaluateSmartCollectionItemIds(
        ownerId,
        r.smartRules as SmartCollectionRules
      );
      results.push({
        ...r,
        itemCount: matchedIds.length,
      });
    } else {
      results.push({
        ...r,
        itemCount: Number(r.itemCount ?? 0),
      });
    }
  }
  return results;
}

export async function renameCollection(
  ownerId: string,
  collectionId: string,
  name: string,
  description?: string
) {
  const cleanName = name.trim();
  if (!cleanName) {
    throw new ValidationError("Nome da coleção não pode ser vazio.");
  }

  const db = await getDb();
  const [col] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!col) throw new NotFoundError("Coleção não encontrada.");
  if (col.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  await db
    .update(collections)
    .set({
      name: cleanName,
      ...(description !== undefined ? { description } : {}),
      updatedAt: new Date(),
    })
    .where(eq(collections.id, collectionId));

  const [updated] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);
  return updated;
}

export async function moveCollection(
  ownerId: string,
  collectionId: string,
  newParentId: string | null
) {
  const db = await getDb();
  const [col] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!col) throw new NotFoundError("Coleção não encontrada.");
  if (col.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  await assertNoCollectionCycle(ownerId, collectionId, newParentId);

  await db
    .update(collections)
    .set({
      parentId: newParentId,
      updatedAt: new Date(),
    })
    .where(eq(collections.id, collectionId));

  const [updated] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);
  return updated;
}

export async function deleteCollection(
  ownerId: string,
  collectionId: string
): Promise<void> {
  const db = await getDb();
  const [col] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!col) throw new NotFoundError("Coleção não encontrada.");
  if (col.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  // Promote direct children to col.parentId before deleting
  await db
    .update(collections)
    .set({ parentId: col.parentId ?? null, updatedAt: new Date() })
    .where(and(eq(collections.ownerId, ownerId), eq(collections.parentId, collectionId)));

  // Deleting a collection does NOT delete the items inside it
  await db.delete(collections).where(eq(collections.id, collectionId));
}

export async function addItemToCollection(
  ownerId: string,
  collectionId: string,
  itemId: string
): Promise<void> {
  const db = await getDb();
  const [col] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!col) throw new NotFoundError("Coleção não encontrada.");
  if (col.ownerId !== ownerId) throw new ForbiddenError("Acesso negado à coleção.");

  await assertItemAccess(ownerId, itemId);

  const [existing] = await db
    .select()
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.itemId, itemId)
      )
    )
    .limit(1);

  if (!existing) {
    await db.insert(collectionItems).values({
      id: generateId("ci"),
      collectionId,
      itemId,
      createdAt: new Date(),
    });
  }
}

export async function removeItemFromCollection(
  ownerId: string,
  collectionId: string,
  itemId: string
): Promise<void> {
  const db = await getDb();
  const [col] = await db
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .limit(1);

  if (!col) throw new NotFoundError("Coleção não encontrada.");
  if (col.ownerId !== ownerId) throw new ForbiddenError("Acesso negado à coleção.");

  await db
    .delete(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.itemId, itemId)
      )
    );
}

// ============================================================================
// HIGHLIGHTS
// ============================================================================

export async function createHighlight(input: {
  ownerId: string;
  itemId: string;
  quote: string;
  note?: string;
  startOffset?: number;
  endOffset?: number;
}) {
  await assertItemAccess(input.ownerId, input.itemId);
  const cleanQuote = input.quote.trim();
  if (!cleanQuote) {
    throw new ValidationError("O trecho destacado não pode ser vazio.");
  }

  const db = await getDb();
  const id = generateId("hlt");

  await db.insert(highlights).values({
    id,
    itemId: input.itemId,
    ownerId: input.ownerId,
    quote: cleanQuote,
    note: input.note?.trim() ?? null,
    startOffset: input.startOffset ?? null,
    endOffset: input.endOffset ?? null,
    createdAt: new Date(),
  });

  const [created] = await db
    .select()
    .from(highlights)
    .where(eq(highlights.id, id))
    .limit(1);
  return created;
}

export async function deleteHighlight(ownerId: string, highlightId: string) {
  const db = await getDb();
  const [hlt] = await db
    .select()
    .from(highlights)
    .where(eq(highlights.id, highlightId))
    .limit(1);

  if (!hlt) throw new NotFoundError("Destaque não encontrado.");
  if (hlt.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  await db.delete(highlights).where(eq(highlights.id, highlightId));
}

// ============================================================================
// AUTOMATION RULES
// ============================================================================

export async function createAutomationRule(input: {
  ownerId: string;
  name: string;
  conditions: {
    domainContains?: string;
    titleContains?: string;
    itemType?: "link" | "note" | "file" | "image";
  };
  actions: {
    addTags?: string[];
    addToCollectionId?: string;
    markFavorite?: boolean;
  };
}) {
  if (!input.name.trim()) {
    throw new ValidationError("Informe um nome para a regra de automação.");
  }

  const db = await getDb();
  const id = generateId("aut");

  await db.insert(automationRules).values({
    id,
    ownerId: input.ownerId,
    name: input.name.trim(),
    isActive: true,
    triggerEvent: "item_created",
    conditions: input.conditions,
    actions: input.actions,
    createdAt: new Date(),
  });

  const [created] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, id))
    .limit(1);
  return created;
}

export async function listAutomationRules(ownerId: string) {
  const db = await getDb();
  return db
    .select()
    .from(automationRules)
    .where(eq(automationRules.ownerId, ownerId));
}

export async function deleteAutomationRule(ownerId: string, ruleId: string) {
  const db = await getDb();
  const [rule] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, ruleId))
    .limit(1);

  if (!rule || rule.ownerId !== ownerId) {
    throw new ForbiddenError("Você não tem permissão para remover esta regra.");
  }

  await db.delete(automationRules).where(eq(automationRules.id, ruleId));
}

