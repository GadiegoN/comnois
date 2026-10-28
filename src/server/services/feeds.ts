import * as cheerio from "cheerio";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { rssFeeds, items } from "@/db/schema";
import { generateId } from "@/lib/security/crypto";
import { SafeFetchOptions, safeFetchUrl, validateSafeUrl } from "@/lib/security/ssrf";
import { normalizeUrlForDeduplication } from "@/lib/security/url-normalizer";
import { createLinkItem } from "./items";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

export interface ParsedFeedEntry {
  title: string;
  url: string;
  summary: string | null;
}

export function parseRssOrAtomXml(xmlContent: string): {
  feedTitle: string;
  siteUrl: string | null;
  entries: ParsedFeedEntry[];
} {
  const $ = cheerio.load(xmlContent, { xmlMode: true });

  const isAtom = $("feed > entry").length > 0 || $("feed").length > 0;
  let feedTitle = "";
  let siteUrl: string | null = null;
  const entries: ParsedFeedEntry[] = [];

  if (isAtom) {
    feedTitle = $("feed > title").first().text().trim() || "Feed Atom";
    siteUrl =
      $("feed > link[rel='alternate']").attr("href") ||
      $("feed > link").first().attr("href") ||
      null;

    $("feed > entry").each((_, el) => {
      const entry = $(el);
      const title = entry.find("title").first().text().trim();
      const linkHref =
        entry.find("link[rel='alternate']").attr("href") ||
        entry.find("link").first().attr("href") ||
        entry.find("id").first().text().trim();
      const summaryRaw =
        entry.find("summary").first().text().trim() ||
        entry.find("content").first().text().trim();
      const cleanSummary = cheerio
        .load(summaryRaw || "")
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600);

      if (linkHref && (linkHref.startsWith("http://") || linkHref.startsWith("https://"))) {
        entries.push({
          title: title || linkHref,
          url: linkHref,
          summary: cleanSummary || null,
        });
      }
    });
  } else {
    feedTitle = $("channel > title").first().text().trim() || "Feed RSS";
    siteUrl = $("channel > link").first().text().trim() || null;

    $("channel > item, item").each((_, el) => {
      const item = $(el);
      const title = item.find("title").first().text().trim();
      const linkHref =
        item.find("link").first().text().trim() ||
        item.find("guid").first().text().trim();
      const descRaw =
        item.find("description").first().text().trim() ||
        item.find("content\\:encoded").first().text().trim();
      const cleanSummary = cheerio
        .load(descRaw || "")
        .text()
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 600);

      if (linkHref && (linkHref.startsWith("http://") || linkHref.startsWith("https://"))) {
        entries.push({
          title: title || linkHref,
          url: linkHref,
          summary: cleanSummary || null,
        });
      }
    });
  }

  return {
    feedTitle,
    siteUrl,
    entries: entries.slice(0, 30),
  };
}

export async function createRssFeed(
  input: {
    ownerId: string;
    feedUrl: string;
    title?: string;
    autoTags?: string[];
    collectionId?: string | null;
  },
  fetchOptions?: SafeFetchOptions
) {
  const validatedUrl = await validateSafeUrl(input.feedUrl.trim(), {
    dnsResolver: fetchOptions?.dnsResolver,
  });
  const canonicalFeedUrl = validatedUrl.toString();

  const db = await getDb();
  const [existing] = await db
    .select()
    .from(rssFeeds)
    .where(and(eq(rssFeeds.ownerId, input.ownerId), eq(rssFeeds.feedUrl, canonicalFeedUrl)))
    .limit(1);

  if (existing) {
    throw new ConflictError("Este feed RSS/Atom já está cadastrado na sua conta.");
  }

  const id = generateId("rss");
  const resolvedTitle =
    input.title && input.title.trim() ? input.title.trim() : validatedUrl.hostname;

  await db.insert(rssFeeds).values({
    id,
    ownerId: input.ownerId,
    title: resolvedTitle,
    feedUrl: canonicalFeedUrl,
    autoTags: input.autoTags ?? ["rss"],
    collectionId: input.collectionId ?? null,
    isActive: true,
    itemsImportedCount: 0,
    createdAt: new Date(),
  });

  const [created] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, id)).limit(1);
  return created;
}

export async function listUserRssFeeds(ownerId: string) {
  const db = await getDb();
  return db
    .select()
    .from(rssFeeds)
    .where(eq(rssFeeds.ownerId, ownerId))
    .orderBy(desc(rssFeeds.createdAt));
}

export async function deleteRssFeed(ownerId: string, feedId: string): Promise<void> {
  const db = await getDb();
  const [feed] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, feedId)).limit(1);
  if (!feed) throw new NotFoundError("Assinatura RSS não encontrada.");
  if (feed.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  await db.delete(rssFeeds).where(eq(rssFeeds.id, feedId));
}

export async function syncRssFeed(
  ownerId: string,
  feedId: string,
  fetchOptions?: SafeFetchOptions
): Promise<{
  feedId: string;
  entriesFound: number;
  importedCount: number;
  skippedDuplicates: number;
}> {
  const db = await getDb();
  const [feed] = await db.select().from(rssFeeds).where(eq(rssFeeds.id, feedId)).limit(1);
  if (!feed) throw new NotFoundError("Assinatura RSS não encontrada.");
  if (feed.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  try {
    const response = await safeFetchUrl(feed.feedUrl, fetchOptions);
    const parsedXml = parseRssOrAtomXml(response.bodyText);

    let importedCount = 0;
    let skippedDuplicates = 0;

    for (const entry of parsedXml.entries) {
      let normUrl: string;
      try {
        normUrl = normalizeUrlForDeduplication(entry.url).normalizedUrl;
      } catch {
        continue;
      }

      const [existingItem] = await db
        .select({ id: items.id })
        .from(items)
        .where(and(eq(items.ownerId, ownerId), eq(items.normalizedUrl, normUrl)))
        .limit(1);

      if (existingItem) {
        skippedDuplicates++;
        continue;
      }

      await createLinkItem(ownerId, {
        url: entry.url,
        title: entry.title,
        summary: entry.summary ?? undefined,
        tags: feed.autoTags.length > 0 ? feed.autoTags : ["rss"],
        collectionId: feed.collectionId ?? undefined,
      });
      importedCount++;
    }

    const updatedTitle =
      feed.title === new URL(feed.feedUrl).hostname && parsedXml.feedTitle
        ? parsedXml.feedTitle
        : feed.title;

    await db
      .update(rssFeeds)
      .set({
        title: updatedTitle,
        siteUrl: parsedXml.siteUrl ?? feed.siteUrl,
        lastSyncedAt: new Date(),
        lastError: null,
        itemsImportedCount: feed.itemsImportedCount + importedCount,
      })
      .where(eq(rssFeeds.id, feed.id));

    return {
      feedId: feed.id,
      entriesFound: parsedXml.entries.length,
      importedCount,
      skippedDuplicates,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message.slice(0, 250) : "Falha ao sincronizar feed.";
    await db
      .update(rssFeeds)
      .set({
        lastSyncedAt: new Date(),
        lastError: errMsg,
      })
      .where(eq(rssFeeds.id, feed.id));
    throw err;
  }
}

