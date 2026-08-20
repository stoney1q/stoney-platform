import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Global singleton cache for PrismaClient in development.
 * Prevents exhausting database connection pool during Next.js hot-module reloading.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not configured.');
  }

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
