import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { processNextJobsBatch } from "@/server/jobs/queue";

async function startWorker() {
  const env = getEnv();
  logger.info("worker.started", {
    concurrency: env.WORKER_CONCURRENCY,
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
  });

  let running = true;
  const stop = () => {
    logger.info("worker.stopping");
    running = false;
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (running) {
    try {
      const result = await processNextJobsBatch({
        limit: env.WORKER_CONCURRENCY,
      });
      if (result.processed > 0) {
        logger.info("worker.batch_completed", result);
      }
    } catch (err) {
      logger.error("worker.loop_error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await new Promise((resolve) => setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS));
  }
}

startWorker().catch((err) => {
  logger.error("worker.fatal", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

