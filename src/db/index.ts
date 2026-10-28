import path from "path";
import fs from "fs";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type AppDatabase = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __comnois_db__: AppDatabase | undefined;
  // eslint-disable-next-line no-var
  var __comnois_pglite__: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __comnois_pg_pool__: Pool | undefined;
  // eslint-disable-next-line no-var
  var __comnois_migrated__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __comnois_init_promise__: Promise<AppDatabase> | undefined;
}

function getMigrationsFolder(): string {
  return path.resolve(process.cwd(), "drizzle");
}

function cleanupStalePgliteLocks(dataDir: string): void {
  try {
    if (!fs.existsSync(dataDir)) return;
    for (const file of ["postmaster.pid", ".s.PGSQL.5432.lock.out", ".s.PGSQL.5432.lock.in"]) {
      const target = path.join(dataDir, file);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { force: true });
      }
    }
  } catch {
    // Ignore filesystem lock cleanup errors
  }
}

async function createAndMigratePglite(
  rawTarget: string,
  migrationsFolder: string
): Promise<AppDatabase> {
  let client: PGlite;
  if (rawTarget === "memory" || rawTarget === ":memory:") {
    client = new PGlite();
  } else {
    const dataDir = path.isAbsolute(rawTarget)
      ? rawTarget
      : path.resolve(process.cwd(), rawTarget);
    fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    cleanupStalePgliteLocks(dataDir);
    client = new PGlite(dataDir);
  }

  await client.waitReady;

  const db = drizzlePglite(client, { schema });
  if (fs.existsSync(migrationsFolder)) {
    await migratePglite(db, { migrationsFolder });
  }

  globalThis.__comnois_pglite__ = client;
  globalThis.__comnois_db__ = db;
  globalThis.__comnois_migrated__ = true;
  logger.info("db.connected", { driver: "pglite", target: rawTarget });
  return db;
}

export async function getDb(): Promise<AppDatabase> {
  if (globalThis.__comnois_db__ && globalThis.__comnois_migrated__) {
    if (globalThis.__comnois_pglite__) {
      try {
        await globalThis.__comnois_pglite__.query("SELECT 1");
        return globalThis.__comnois_db__;
      } catch {
        globalThis.__comnois_pglite__ = undefined;
        globalThis.__comnois_db__ = undefined;
        globalThis.__comnois_migrated__ = undefined;
      }
    } else {
      return globalThis.__comnois_db__;
    }
  }

  if (globalThis.__comnois_init_promise__) {
    return globalThis.__comnois_init_promise__;
  }

  globalThis.__comnois_init_promise__ = (async () => {
    const env = getEnv();
    const url = env.DATABASE_URL;
    const migrationsFolder = getMigrationsFolder();

    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      const pool =
        globalThis.__comnois_pg_pool__ ??
        new Pool({
          connectionString: url,
          max: 10,
        });
      const db = drizzlePg(pool, { schema });
      if (fs.existsSync(migrationsFolder) && !globalThis.__comnois_migrated__) {
        await migratePg(db, { migrationsFolder });
      }
      globalThis.__comnois_pg_pool__ = pool;
      globalThis.__comnois_db__ = db;
      globalThis.__comnois_migrated__ = true;
      logger.info("db.connected", { driver: "node-postgres" });
      return db;
    }

    // Default / pglite:// mode (PostgreSQL 16 embedded)
    const rawTarget = url.replace(/^pglite:\/\//, "");
    try {
      return await createAndMigratePglite(rawTarget, migrationsFolder);
    } catch (err) {
      logger.warn("db.pglite_recovery_started", {
        target: rawTarget,
        reason: err instanceof Error ? err.message : String(err),
      });

      try {
        await globalThis.__comnois_pglite__?.close();
      } catch {
        // ignore close errors
      }
      globalThis.__comnois_pglite__ = undefined;
      globalThis.__comnois_db__ = undefined;
      globalThis.__comnois_migrated__ = undefined;

      if (rawTarget !== "memory" && rawTarget !== ":memory:") {
        const dataDir = path.isAbsolute(rawTarget)
          ? rawTarget
          : path.resolve(process.cwd(), rawTarget);
        try {
          if (fs.existsSync(dataDir)) {
            fs.rmSync(dataDir, { recursive: true, force: true });
          }
        } catch {
          // ignore
        }
      }

      return await createAndMigratePglite(rawTarget, migrationsFolder);
    }
  })();

  try {
    return await globalThis.__comnois_init_promise__;
  } finally {
    globalThis.__comnois_init_promise__ = undefined;
  }
}

export async function resetDatabaseForTests(): Promise<AppDatabase> {
  if (globalThis.__comnois_pglite__) {
    try {
      await globalThis.__comnois_pglite__.close();
    } catch {
      // ignore close errors on reset
    }
  }
  globalThis.__comnois_pglite__ = undefined;
  globalThis.__comnois_db__ = undefined;
  globalThis.__comnois_migrated__ = undefined;
  globalThis.__comnois_init_promise__ = undefined;
  process.env.DATABASE_URL = "pglite://memory";
  return getDb();
}
