import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { env } from "../env";

/**
 * The pool outlives a single request on Vercel's Fluid compute, so it must survive the database's pooler
 * closing idle sockets underneath it. Idle clients are dropped here before the server drops them, and an
 * error on an idle client evicts that client instead of throwing into whatever request is in flight.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
});
pool.on("error", (err) => {
  console.error("[pg pool] idle client dropped:", err.message);
});

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
