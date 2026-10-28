import { eq, and, inArray, lte } from "drizzle-orm";
import { getDb } from "@/db";
import {
  items,
  itemContents,
  assets,
  processingJobs,
  tags,
  itemTags,
  automationRules,
  collectionItems,
} from "@/db/schema";
import { generateId, sha256Hex } from "@/lib/security/crypto";
import {
  EXTRACTOR_VERSION,
  extractTextFromPdfBuffer,
  fetchAndExtractWebPage,
} from "./extractor";
import { SafeFetchOptions } from "@/lib/security/ssrf";
import { getStorageProvider } from "@/server/storage";
import { indexItemContent, removeItemFromSearchIndex } from "@/server/search";
import {
  checkAndRecordAiUsage,
  getUserAiConfig,
  resolveAiProviderForUser,
} from "@/server/ai/providers";
import { normalizeSearchText } from "@/server/search/chunker";
import { dispatchWebhookEvent } from "@/server/services/webhooks";
import { logger } from "@/lib/logger";

export type JobType =
  | "fetch_link"
  | "extract_content"
  | "ocr_asset"
  | "chunk_and_index"
  | "generate_ai_metadata"
  | "generate_embeddings"
  | "delete_derived_data";

export async function enqueueJob(input: {
  ownerId: string;
  itemId?: string | null;
  jobType: JobType;
  payload?: Record<string, unknown>;
  targetContentVersion?: number;
  maxAttempts?: number;
  timeoutMs?: number;
  forceImmediate?: boolean;
}): Promise<{ jobId: string; deduplicated: boolean }> {
  const db = await getDb();
  const version = input.targetContentVersion ?? 1;
  const idempotencyKey = input.itemId
    ? `${input.jobType}:${input.itemId}:v${version}`
    : undefined;

  if (idempotencyKey && input.itemId) {
    const existing = await db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.itemId, input.itemId),
          eq(processingJobs.idempotencyKey, idempotencyKey),
          inArray(processingJobs.status, ["pending", "processing", "retrying"])
        )
      )
      .limit(1);

    if (existing.length > 0) {
      if (input.forceImmediate && existing[0].status === "retrying") {
        const now = new Date();
        await db
          .update(processingJobs)
          .set({
            status: "pending",
            nextRunAt: now,
            lastError: null,
            updatedAt: now,
          })
          .where(eq(processingJobs.id, existing[0].id));
      }
      return { jobId: existing[0].id, deduplicated: true };
    }
  }

  const jobId = generateId("job");
  const now = new Date();

  await db.insert(processingJobs).values({
    id: jobId,
    ownerId: input.ownerId,
    itemId: input.itemId ?? null,
    jobType: input.jobType,
    status: "pending",
    payload: input.payload ?? {},
    targetContentVersion: version,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    timeoutMs: input.timeoutMs ?? 20000,
    nextRunAt: now,
    idempotencyKey: idempotencyKey ?? null,
    createdAt: now,
    updatedAt: now,
  });

  return { jobId, deduplicated: false };
}

export async function recoverStaleJobs(): Promise<number> {
  const db = await getDb();
  const now = new Date();

  const runningJobs = await db
    .select()
    .from(processingJobs)
    .where(eq(processingJobs.status, "processing"));

  let recoveredCount = 0;

  for (const job of runningJobs) {
    const startedMs = job.startedAt ? job.startedAt.getTime() : job.updatedAt.getTime();
    if (now.getTime() - startedMs > job.timeoutMs) {
      const canRetry = job.attempts < job.maxAttempts;
      const nextStatus = canRetry ? "retrying" : "failed";
      const backoffMs = Math.min(60_000, 1000 * Math.pow(2, job.attempts));

      await db
        .update(processingJobs)
        .set({
          status: nextStatus,
          nextRunAt: new Date(now.getTime() + backoffMs),
          lastError: "Tarefa interrompida por timeout ou reinício do worker.",
          finishedAt: canRetry ? null : now,
          updatedAt: now,
        })
        .where(eq(processingJobs.id, job.id));

      if (!canRetry && job.itemId) {
        await db
          .update(items)
          .set({
            processingStatus: "failed",
            processingError: "Processamento excedeu o tempo limite após múltiplas tentativas.",
            updatedAt: now,
          })
          .where(eq(items.id, job.itemId));
      }

      recoveredCount++;
    }
  }

  return recoveredCount;
}

async function applyAutomationRules(itemId: string): Promise<void> {
  const db = await getDb();
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) return;

  const rules = await db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.ownerId, item.ownerId),
        eq(automationRules.isActive, true)
      )
    );

  for (const rule of rules) {
    const cond = rule.conditions;
    let matches = true;

    if (cond.itemType && cond.itemType !== item.type) {
      matches = false;
    }
    if (
      matches &&
      cond.domainContains &&
      !(item.domain ?? "").toLowerCase().includes(cond.domainContains.toLowerCase())
    ) {
      matches = false;
    }
    if (
      matches &&
      cond.titleContains &&
      !item.title.toLowerCase().includes(cond.titleContains.toLowerCase())
    ) {
      matches = false;
    }

    if (!matches) continue;

    if (rule.actions.markFavorite) {
      await db
        .update(items)
        .set({ isFavorite: true, updatedAt: new Date() })
        .where(eq(items.id, item.id));
    }

    if (rule.actions.addToCollectionId) {
      const existingCol = await db
        .select()
        .from(collectionItems)
        .where(
          and(
            eq(collectionItems.collectionId, rule.actions.addToCollectionId),
            eq(collectionItems.itemId, item.id)
          )
        )
        .limit(1);

      if (existingCol.length === 0) {
        await db.insert(collectionItems).values({
          id: generateId("ci"),
          collectionId: rule.actions.addToCollectionId,
          itemId: item.id,
          createdAt: new Date(),
        });
      }
    }

    if (rule.actions.addTags && rule.actions.addTags.length > 0) {
      for (const rawTag of rule.actions.addTags) {
        const cleanName = rawTag.trim();
        const normName = normalizeSearchText(cleanName);
        if (!normName) continue;

        let [tagRow] = await db
          .select()
          .from(tags)
          .where(
            and(eq(tags.ownerId, item.ownerId), eq(tags.normalizedName, normName))
          )
          .limit(1);

        if (!tagRow) {
          const newTagId = generateId("tag");
          await db.insert(tags).values({
            id: newTagId,
            ownerId: item.ownerId,
            workspaceId: item.workspaceId,
            name: cleanName,
            normalizedName: normName,
            createdAt: new Date(),
          });
          [tagRow] = await db.select().from(tags).where(eq(tags.id, newTagId)).limit(1);
        }

        if (tagRow) {
          const existingAssoc = await db
            .select()
            .from(itemTags)
            .where(
              and(eq(itemTags.itemId, item.id), eq(itemTags.tagId, tagRow.id))
            )
            .limit(1);

          if (existingAssoc.length === 0) {
            await db.insert(itemTags).values({
              id: generateId("itg"),
              itemId: item.id,
              tagId: tagRow.id,
              source: "automation",
              isConfirmed: true,
              createdAt: new Date(),
            });
          }
        }
      }
    }
  }
}

export interface JobExecutionContext {
  fetchOptions?: SafeFetchOptions;
}

async function executeSingleJob(
  job: typeof processingJobs.$inferSelect,
  context?: JobExecutionContext
): Promise<void> {
  const db = await getDb();

  if (job.jobType === "delete_derived_data") {
    const targetItemId = (job.payload?.itemId as string) || job.itemId;
    if (targetItemId) {
      await removeItemFromSearchIndex(targetItemId);
    }
    return;
  }

  if (!job.itemId) {
    return;
  }

  // Always re-read item from database to verify existence and version
  const [item] = await db.select().from(items).where(eq(items.id, job.itemId)).limit(1);

  if (!item) {
    logger.warn("worker.item_deleted_before_execution", {
      jobId: job.id,
      itemId: job.itemId,
    });
    await removeItemFromSearchIndex(job.itemId);
    await db
      .update(processingJobs)
      .set({
        status: "cancelled",
        lastError: "Item excluído antes ou durante o processamento.",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, job.id));
    return;
  }

  // Version check: never allow an older job to overwrite a newer version of the item
  if (item.contentVersion > job.targetContentVersion) {
    logger.info("worker.job_superseded_by_newer_version", {
      jobId: job.id,
      itemId: item.id,
      itemVersion: item.contentVersion,
      jobVersion: job.targetContentVersion,
    });
    await db
      .update(processingJobs)
      .set({
        status: "cancelled",
        lastError: "Versão do conteúdo superada por edição mais recente.",
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(processingJobs.id, job.id));
    return;
  }

  await db
    .update(items)
    .set({ processingStatus: "processing", updatedAt: new Date() })
    .where(eq(items.id, item.id));

  if (job.jobType === "fetch_link") {
    if (!item.originalUrl) {
      throw new Error("Item do tipo link não possui URL de origem.");
    }

    const extracted = await fetchAndExtractWebPage(
      item.originalUrl,
      context?.fetchOptions
    );

    // Re-check that item still exists and hasn't been edited to a newer version during network fetch
    const [freshItem] = await db
      .select()
      .from(items)
      .where(eq(items.id, item.id))
      .limit(1);

    if (!freshItem) {
      await removeItemFromSearchIndex(item.id);
      return;
    }

    if (freshItem.contentVersion > job.targetContentVersion) {
      return;
    }

    const contentHash = sha256Hex(extracted.extractedText || extracted.title);
    const [existingContent] = await db
      .select()
      .from(itemContents)
      .where(eq(itemContents.itemId, item.id))
      .limit(1);

    if (existingContent) {
      await db
        .update(itemContents)
        .set({
          extractedText: extracted.extractedText,
          sanitizedHtml: extracted.sanitizedHtml,
          language: extracted.language,
          extractionOrigin: "web_scraper",
          extractorVersion: EXTRACTOR_VERSION,
          contentHash,
          contentVersion: freshItem.contentVersion,
          updatedAt: new Date(),
        })
        .where(eq(itemContents.itemId, item.id));
    } else {
      await db.insert(itemContents).values({
        id: generateId("cnt"),
        itemId: item.id,
        extractedText: extracted.extractedText,
        sanitizedHtml: extracted.sanitizedHtml,
        language: extracted.language,
        extractionOrigin: "web_scraper",
        extractorVersion: EXTRACTOR_VERSION,
        contentHash,
        contentVersion: freshItem.contentVersion,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const preserveUserTitle =
      freshItem.title &&
      freshItem.title !== freshItem.originalUrl &&
      Boolean(freshItem.metadata?.userProvidedTitle);

    await db
      .update(items)
      .set({
        title: preserveUserTitle ? freshItem.title : extracted.title || freshItem.title,
        summary: freshItem.summary || extracted.description || null,
        summarySource: freshItem.summary ? freshItem.summarySource : "extracted",
        metadata: {
          ...freshItem.metadata,
          ...extracted.metadata,
        },
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(items.id, item.id));

    await indexItemContent(item.id, {
      expectedContentVersion: freshItem.contentVersion,
    });

    await applyAutomationRules(item.id);

    // Optional AI enrichment (summary & suggested tags)
    let partialAiWarning: string | null = null;
    try {
      const aiCfg = await getUserAiConfig(item.ownerId);
      if (aiCfg.isEnabled && (aiCfg.autoSummarize || aiCfg.autoSuggestTags)) {
        const provider = await resolveAiProviderForUser(item.ownerId);
        const enrichment = await provider.summarizeAndSuggestTags({
          title: extracted.title || freshItem.title,
          content: extracted.extractedText || extracted.description,
        });

        await checkAndRecordAiUsage({
          ownerId: item.ownerId,
          provider: provider.getCapabilities().provider,
          model: provider.getCapabilities().modelVersion,
          operation: "summary",
          inputTokens: enrichment.tokensUsed,
          outputTokens: 30,
        });

        if (aiCfg.autoSummarize && !freshItem.summary && !extracted.description) {
          await db
            .update(items)
            .set({
              summary: enrichment.summary,
              summarySource: "ai",
              updatedAt: new Date(),
            })
            .where(eq(items.id, item.id));
        }

        if (aiCfg.autoSuggestTags && enrichment.suggestedTags.length > 0) {
          for (const rawTag of enrichment.suggestedTags) {
            const normName = normalizeSearchText(rawTag);
            if (!normName) continue;

            let [tagRecord] = await db
              .select()
              .from(tags)
              .where(
                and(eq(tags.ownerId, item.ownerId), eq(tags.normalizedName, normName))
              )
              .limit(1);

            if (!tagRecord) {
              const tid = generateId("tag");
              await db.insert(tags).values({
                id: tid,
                ownerId: item.ownerId,
                workspaceId: item.workspaceId,
                name: rawTag,
                normalizedName: normName,
                createdAt: new Date(),
              });
              [tagRecord] = await db.select().from(tags).where(eq(tags.id, tid)).limit(1);
            }

            if (tagRecord) {
              // Never overwrite manual tags!
              const [existingItemTag] = await db
                .select()
                .from(itemTags)
                .where(
                  and(eq(itemTags.itemId, item.id), eq(itemTags.tagId, tagRecord.id))
                )
                .limit(1);

              if (!existingItemTag) {
                await db.insert(itemTags).values({
                  id: generateId("itg"),
                  itemId: item.id,
                  tagId: tagRecord.id,
                  source: "ai",
                  isConfirmed: false,
                  createdAt: new Date(),
                });
              }
            }
          }
        }
      }
    } catch (aiErr) {
      partialAiWarning =
        aiErr instanceof Error
          ? `Extração concluída, mas enriquecimento de IA falhou: ${aiErr.message}`
          : "Enriquecimento opcional de IA indisponível.";
    }

    await db
      .update(items)
      .set({
        processingStatus: partialAiWarning ? "partial" : "completed",
        processingError: partialAiWarning,
        updatedAt: new Date(),
      })
      .where(eq(items.id, item.id));

    return;
  }

  if (job.jobType === "extract_content" || job.jobType === "ocr_asset") {
    const [assetRecord] = await db
      .select()
      .from(assets)
      .where(eq(assets.itemId, item.id))
      .limit(1);

    if (!assetRecord) {
      throw new Error("Arquivo associado ao item não foi encontrado.");
    }

    const storage = getStorageProvider();
    const buffer = await storage.getObject(assetRecord.storageKey);

    let extractedText = "";
    let extractionOrigin: "pdf_parser" | "ocr" | "user_note" = "pdf_parser";
    let isPartial = false;
    let partialMessage: string | null = null;

    if (assetRecord.mimeType === "application/pdf") {
      extractedText = extractTextFromPdfBuffer(buffer);
      extractionOrigin = "pdf_parser";
      if (!extractedText) {
        isPartial = true;
        partialMessage =
          "PDF armazenado com sucesso, mas não continha camada de texto selecionável.";
      }
    } else if (assetRecord.mimeType.startsWith("image/")) {
      extractionOrigin = "ocr";
      // Check if image has embedded textual metadata or user caption
      const caption = (item.metadata?.ocrText as string) || item.summary || "";
      if (caption) {
        extractedText = `[Texto reconhecido via OCR — sujeito a imprecisões]: ${caption}`;
      } else {
        isPartial = true;
        partialMessage =
          "Imagem armazenada com segurança. Nenhum provedor externo de OCR configurado para extração óptica.";
      }
    } else {
      extractedText = buffer.toString("utf8").slice(0, 200_000);
      extractionOrigin = "pdf_parser";
    }

    const contentHash = sha256Hex(extractedText || item.title);
    const [existingContent] = await db
      .select()
      .from(itemContents)
      .where(eq(itemContents.itemId, item.id))
      .limit(1);

    if (existingContent) {
      await db
        .update(itemContents)
        .set({
          extractedText,
          extractionOrigin,
          extractorVersion: EXTRACTOR_VERSION,
          contentHash,
          contentVersion: item.contentVersion,
          updatedAt: new Date(),
        })
        .where(eq(itemContents.itemId, item.id));
    } else {
      await db.insert(itemContents).values({
        id: generateId("cnt"),
        itemId: item.id,
        extractedText,
        extractionOrigin,
        extractorVersion: EXTRACTOR_VERSION,
        contentHash,
        contentVersion: item.contentVersion,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await indexItemContent(item.id, {
      expectedContentVersion: item.contentVersion,
    });

    await applyAutomationRules(item.id);

    await db
      .update(items)
      .set({
        processingStatus: isPartial ? "partial" : "completed",
        processingError: partialMessage,
        updatedAt: new Date(),
      })
      .where(eq(items.id, item.id));

    return;
  }

  if (job.jobType === "chunk_and_index" || job.jobType === "generate_embeddings") {
    await indexItemContent(item.id, {
      generateEmbeddings: true,
      expectedContentVersion: job.targetContentVersion,
    });
    await applyAutomationRules(item.id);
    await db
      .update(items)
      .set({
        processingStatus: "completed",
        processingError: null,
        updatedAt: new Date(),
      })
      .where(eq(items.id, item.id));
    return;
  }
}

export async function processNextJobsBatch(options?: {
  limit?: number;
  fetchOptions?: SafeFetchOptions;
}): Promise<{
  processed: number;
  succeeded: number;
  retried: number;
  failed: number;
}> {
  await recoverStaleJobs();

  const db = await getDb();
  const limit = Math.max(1, Math.min(20, options?.limit ?? 5));
  const now = new Date();

  const dueJobs = await db
    .select()
    .from(processingJobs)
    .where(
      and(
        inArray(processingJobs.status, ["pending", "retrying"]),
        lte(processingJobs.nextRunAt, now)
      )
    )
    .limit(limit);

  let succeeded = 0;
  let retried = 0;
  let failed = 0;

  for (const job of dueJobs) {
    const attemptNumber = job.attempts + 1;
    const startNow = new Date();

    await db
      .update(processingJobs)
      .set({
        status: "processing",
        attempts: attemptNumber,
        startedAt: startNow,
        updatedAt: startNow,
      })
      .where(eq(processingJobs.id, job.id));

    try {
      await Promise.race([
        executeSingleJob(job, { fetchOptions: options?.fetchOptions }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Tempo limite de execução do job excedido.")),
            job.timeoutMs
          )
        ),
      ]);

      // Check if job was marked cancelled during execution
      const [postJob] = await db
        .select({ status: processingJobs.status })
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id))
        .limit(1);

      if (postJob && postJob.status !== "cancelled") {
        await db
          .update(processingJobs)
          .set({
            status: "succeeded",
            lastError: null,
            finishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(processingJobs.id, job.id));

        if (job.itemId) {
          void dispatchWebhookEvent(
            job.ownerId,
            "item.processed",
            {
              itemId: job.itemId,
              jobId: job.id,
              jobType: job.jobType,
            },
            {
              dnsResolver: options?.fetchOptions?.dnsResolver,
              fetchImpl: options?.fetchOptions?.fetchImpl,
            }
          ).catch(() => {});
        }
      }

      succeeded++;
      logger.info("worker.job_succeeded", {
        jobId: job.id,
        jobType: job.jobType,
        itemId: job.itemId,
        attempt: attemptNumber,
      });
    } catch (err) {
      const safeErrorMsg =
        err instanceof Error
          ? err.message.slice(0, 300)
          : "Erro inesperado durante o processamento em segundo plano.";

      const canRetry = attemptNumber < job.maxAttempts;
      const backoffMs = Math.min(30_000, 500 * Math.pow(2, attemptNumber));
      const finishTime = new Date();

      await db
        .update(processingJobs)
        .set({
          status: canRetry ? "retrying" : "failed",
          lastError: safeErrorMsg,
          nextRunAt: new Date(finishTime.getTime() + backoffMs),
          finishedAt: canRetry ? null : finishTime,
          updatedAt: finishTime,
        })
        .where(eq(processingJobs.id, job.id));

      if (job.itemId) {
        await db
          .update(items)
          .set({
            processingStatus: canRetry ? "processing" : "failed",
            processingError: safeErrorMsg,
            updatedAt: finishTime,
          })
          .where(eq(items.id, job.itemId));
      }

      if (canRetry) {
        retried++;
        logger.warn("worker.job_scheduled_retry", {
          jobId: job.id,
          jobType: job.jobType,
          attempt: attemptNumber,
          maxAttempts: job.maxAttempts,
          error: safeErrorMsg,
        });
      } else {
        failed++;
        logger.error("worker.job_failed_permanently", {
          jobId: job.id,
          jobType: job.jobType,
          attempt: attemptNumber,
          error: safeErrorMsg,
        });
      }
    }
  }

  return {
    processed: dueJobs.length,
    succeeded,
    retried,
    failed,
  };
}

export async function getQueueMetrics(ownerId?: string) {
  const db = await getDb();
  const rows = ownerId
    ? await db
        .select()
        .from(processingJobs)
        .where(eq(processingJobs.ownerId, ownerId))
    : await db.select().from(processingJobs);

  const counts = {
    pending: 0,
    processing: 0,
    retrying: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    total: rows.length,
  };

  let oldestPendingAt: Date | null = null;

  for (const r of rows) {
    counts[r.status] = (counts[r.status] ?? 0) + 1;
    if (r.status === "pending" || r.status === "retrying") {
      if (!oldestPendingAt || r.createdAt < oldestPendingAt) {
        oldestPendingAt = r.createdAt;
      }
    }
  }

  return {
    counts,
    oldestPendingAgeMs: oldestPendingAt ? Date.now() - oldestPendingAt.getTime() : 0,
    recentJobs: rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 30),
  };
}
