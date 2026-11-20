import "server-only";
import { Pool } from "pg";

// One pool per server instance. Only server code imports this file.
const globalForDb = globalThis as unknown as { warbagPool?: Pool };

export const pool =
  globalForDb.warbagPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.warbagPool = pool;
