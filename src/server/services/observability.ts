import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { assets, items, processingJobs } from "@/db/schema";
import { getQueueMetrics } from "@/server/jobs/queue";
import { getUserAiUsageSummary } from "@/server/ai/providers";
import {
  EmbeddingIndexDiagnostics,
  getEmbeddingIndexDiagnostics,
} from "@/server/search";
import { getStorageProvider } from "@/server/storage";
import { logger } from "@/lib/logger";

export interface SystemHealthReport {
  status: "healthy" | "degraded";
  timestamp: string;
  database: {
    connected: boolean;
    latencyMs: number;
  };
  queue: {
    pendingCount: number;
    failedCount: number;
    oldestPendingAgeMs: number;
  };
  storage: {
    totalFiles: number;
    totalBytes: number;
    integrityVerifiedCount: number;
    missingBlobsCount: number;
  };
  embeddingIndex?: EmbeddingIndexDiagnostics;
  aiUsageToday?: {
    totalTokensToday: number;
    dailyTokenLimit: number;
    estimatedCostUsd: number;
  };
  recentLogs: ReturnType<typeof logger.getRecentLogs>;
}

export async function getSystemHealthAndBackupIntegrity(
  ownerId?: string
): Promise<SystemHealthReport> {
  const startDb = performance.now();
  const db = await getDb();

  await db.select({ count: sql<number>`count(*)` }).from(items);
  const dbLatencyMs = Number((performance.now() - startDb).toFixed(2));

  const queue = await getQueueMetrics(ownerId);

  const assetRows = ownerId
    ? await db.select().from(assets).where(eq(assets.ownerId, ownerId))
    : await db.select().from(assets);

  let totalBytes = 0;
  let integrityVerifiedCount = 0;
  let missingBlobsCount = 0;
  const storage = getStorageProvider();

  for (const a of assetRows) {
    totalBytes += a.sizeBytes;
    try {
      const buf = await storage.getObject(a.storageKey);
      if (buf.length === a.sizeBytes) {
        integrityVerifiedCount++;
      } else {
        missingBlobsCount++;
      }
    } catch {
      missingBlobsCount++;
    }
  }

  const aiUsageToday = ownerId ? await getUserAiUsageSummary(ownerId) : undefined;
  const embeddingIndex = ownerId
    ? await getEmbeddingIndexDiagnostics(ownerId)
    : undefined;

  const isDegraded =
    missingBlobsCount > 0 || queue.oldestPendingAgeMs > 1000 * 60 * 30;

  return {
    status: isDegraded ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    database: {
      connected: true,
      latencyMs: dbLatencyMs,
    },
    queue: {
      pendingCount: queue.counts.pending + queue.counts.retrying,
      failedCount: queue.counts.failed,
      oldestPendingAgeMs: queue.oldestPendingAgeMs,
    },
    storage: {
      totalFiles: assetRows.length,
      totalBytes,
      integrityVerifiedCount,
      missingBlobsCount,
    },
    ...(embeddingIndex ? { embeddingIndex } : {}),
    ...(aiUsageToday ? { aiUsageToday } : {}),
    recentLogs: logger.getRecentLogs().slice(-20),
  };
}

