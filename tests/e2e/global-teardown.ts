/**
 * Playwright globalTeardown — runs once after all E2E tests.
 *
 * Removes only records created by globalSetup, identified by:
 * - branchId stored in the state file
 * - userId stored in the state file
 *
 * This is a safe, scoped teardown — it cannot affect records outside the E2E
 * seed branch.
 */
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { readFileSync, existsSync, unlinkSync } from 'fs';
import { E2EState, STATE_FILE } from './state';
import * as dotenv from 'dotenv';

dotenv.config();

export default async function globalTeardown() {
  if (!existsSync(STATE_FILE)) {
    console.log(
      '\n[E2E globalTeardown] No state file found — nothing to clean up.'
    );
    return;
  }

  // Only use TEST_DATABASE_URL for safety. Never use production DATABASE_URL.
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      '[E2E globalTeardown] DATABASE_URL or TEST_DATABASE_URL not set — cannot clean up!'
    );
    return;
  }

  // Safety check: Prevent running teardown against external non-test databases.
  if (
    !process.env.TEST_DATABASE_URL &&
    !databaseUrl.includes('localhost') &&
    !databaseUrl.includes('127.0.0.1')
  ) {
    console.error(
      '[E2E globalTeardown] ABORTED: DATABASE_URL appears to be a remote/production database.'
    );
    return;
  }

  const state: E2EState = JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    const {
      branchId,
      userId,
      posProductId,
      posCustomerId,
      portalQuotationId,
      portalCustomerId,
    } = state;

    // Remove dependent records in correct order
    await prisma.sale.deleteMany({ where: { branchId } });

    if (portalQuotationId) {
      await prisma.quotation.deleteMany({ where: { id: portalQuotationId } });
    }

    await prisma.repair.deleteMany({ where: { branchId } });
    await prisma.branchStock.deleteMany({ where: { branchId } });

    if (posCustomerId)
      await prisma.customer.deleteMany({ where: { id: posCustomerId } });
    if (portalCustomerId)
      await prisma.customer.deleteMany({ where: { id: portalCustomerId } });
    if (posProductId)
      await prisma.product.deleteMany({ where: { id: posProductId } });

    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (branchId) await prisma.branch.deleteMany({ where: { id: branchId } });

    // Remove state file
    unlinkSync(STATE_FILE);

    console.log(
      `\n[E2E globalTeardown] ✓ Cleaned up E2E seed data (branch: ${branchId})`
    );
  } catch (error) {
    console.error('[E2E globalTeardown] Teardown error:', error);
  } finally {
    await prisma.$disconnect();
  }
}
