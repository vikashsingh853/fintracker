import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const adapter = new PrismaPg({
    connectionString,
    /*
     * Supabase's transaction pooler multiplexes these onto far fewer real
     * Postgres connections, so a small pool here is safe — and necessary.
     * With max: 1 every query in a request serialises behind one connection,
     * which turns a page of ~30 queries into ~30 × the round-trip latency.
     */
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });

  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  // Reused across hot reloads in dev, and across warm invocations of the
  // same serverless instance in production.
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * Lazily constructed: the client is only created on first real property
 * access. `next build` evaluates modules to collect route config and must not
 * need a database connection to do so.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getClient();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
