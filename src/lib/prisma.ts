import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { validateEnv } from "./env";
import { logger } from "./logger";

// Configure WebSocket for Node.js environments
neonConfig.webSocketConstructor = ws;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  envValidated: boolean | undefined;
};

// Validate environment variables once at startup
if (!globalForPrisma.envValidated) {
  try {
    validateEnv();
    globalForPrisma.envValidated = true;
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      logger.error("Environment validation failed", { error });
    }
    // In development, we may want to continue despite missing optional vars
    // In production, this should fail hard
    if (process.env.NODE_ENV === "production") {
      throw error;
    }
  }
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
