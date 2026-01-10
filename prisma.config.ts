// Prisma 7.x configuration
// Uses process.env directly to allow builds without DATABASE_URL
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use process.env with fallback to allow prisma generate without DATABASE_URL
    // Migrations will fail with a clear error if DATABASE_URL is missing
    url: process.env.DATABASE_URL ?? "postgresql://placeholder",
  },
});
