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

export async function getDb(): Promise<AppDatabase> {
  if (globalThis.__comnois_db__ && globalThis.__comnois_migrated__) {
    return globalThis.__comnois_db__;
  }

  if (globalThis.__comnois_init_promise__) {
    return globalThis.__comnois_init_promise__;
  }

  globalThis.__comnois_init_promise__ = (async () => {
    const env = getEnv();
    const url = env.DATABASE_URL;
    const migrationsFolder = getMigrationsFolder();

    if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
      const pool = new Pool({
        connectionString: url,
        max: 10,
      });
      const db = drizzlePg(pool, { schema });
      if (fs.existsSync(migrationsFolder)) {
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
    let client: PGlite;
    if (rawTarget === "memory" || rawTarget === ":memory:") {
      client = new PGlite();
    } else {
      const dataDir = path.isAbsolute(rawTarget)
        ? rawTarget
        : path.resolve(process.cwd(), rawTarget);
      fs.mkdirSync(path.dirname(dataDir), { recursive: true });
      client = new PGlite(dataDir);
    }

    const db = drizzlePglite(client, { schema });
    if (fs.existsSync(migrationsFolder)) {
      await migratePglite(db, { migrationsFolder });
    }

    globalThis.__comnois_pglite__ = client;
    globalThis.__comnois_db__ = db;
    globalThis.__comnois_migrated__ = true;
    logger.info("db.connected", { driver: "pglite", target: rawTarget });
    return db;
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

