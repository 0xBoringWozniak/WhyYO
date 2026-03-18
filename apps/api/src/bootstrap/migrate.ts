import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Pool } from "pg";

import { getDb } from "../db/pool";

export const applyMigrations = async (db: Pool = getDb()): Promise<string[]> => {
  const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../migrations");
  const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await db.query(sql);
  }

  return files;
};
