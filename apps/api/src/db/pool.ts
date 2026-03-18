import { Pool } from "pg";

import { getEnv } from "../config/env";

let pool: Pool | null = null;

export const getDb = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: getEnv().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 10_000,
    });
  }
  return pool;
};
