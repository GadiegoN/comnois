import { getDb } from "./index";
import { logger } from "@/lib/logger";

async function main() {
  logger.info("db.migration.start");
  await getDb();
  logger.info("db.migration.completed");
}

main().catch((err) => {
  logger.error("db.migration.failed", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

