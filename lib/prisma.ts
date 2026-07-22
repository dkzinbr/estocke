import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import "dotenv/config";

/**
 * Bump this whenever the Prisma schema changes so Next/Turbopack
 * discards a stale global PrismaClient that still expects old columns.
 */
const PRISMA_SCHEMA_VERSION = "2026-07-22-must-change-password";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: string;
};

const REQUIRED_DELEGATES = [
  "product",
  "employee",
  "productMalfunction",
  "productRequest",
  "department",
  "stockMovement",
  "activityEvent",
] as const;

function hasRequiredDelegates(client: PrismaClient) {
  const record = client as unknown as Record<string, unknown>;
  return REQUIRED_DELEGATES.every(
    (key) => record[key] != null && typeof record[key] === "object",
  );
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  const cached = globalForPrisma.prisma;
  if (
    cached &&
    globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION &&
    hasRequiredDelegates(cached)
  ) {
    return cached;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  return client;
}

/** Lazy proxy so HMR always resolves through the versioned getter. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
