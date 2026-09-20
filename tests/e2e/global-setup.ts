/**
 * Playwright globalSetup — runs once before all E2E tests.
 *
 * Executes in a plain Node.js process (not inside Next.js), so it can use
 * Prisma directly via a standard TCP connection (DATABASE_URL from .env).
 *
 * Creates isolated, deterministic test data and writes its IDs to a shared
 * state file that test fixtures read at runtime.
 *
 * Security: no data is injected into application authentication. The test
 * user must exist in the database; tests interact with the running app as any
 * real user would — but they authenticate using a real Firebase ID token
 * obtained with the E2E_FIREBASE_TEST_EMAIL/E2E_FIREBASE_TEST_PASSWORD env
 * vars (optional; browser tests that only check public flows skip auth).
 */
import type { FullConfig } from '@playwright/test';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const SEED_EMAIL_PREFIX = 'e2e-seed-';
const SEED_BRANCH_CODE_PREFIX = 'E2E-BRANCH-';

import { E2EState, STATE_FILE } from './state';

export default async function globalSetup(_config: FullConfig) {
  // Only use TEST_DATABASE_URL for safety. Never use production DATABASE_URL.
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or TEST_DATABASE_URL must be set for E2E globalSetup');
  }

  // Safety check: Prevent running tests against external non-test databases.
  if (
    !process.env.TEST_DATABASE_URL &&
    !databaseUrl.includes('localhost') &&
    !databaseUrl.includes('127.0.0.1')
  ) {
    throw new Error(
      'PLAYWRIGHT ABORTED: DATABASE_URL appears to be a remote/production database. ' +
      'To run E2E tests locally, you MUST set TEST_DATABASE_URL in your .env ' +
      'pointing to an isolated test database.'
    );
  }

  // PrismaClient using PrismaNeon adapter (required for Neon serverless databases)
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  const timestamp = Date.now();
  const branchCode = `${SEED_BRANCH_CODE_PREFIX}${timestamp}`;
  const userEmail = `${SEED_EMAIL_PREFIX}${timestamp}@e2e.internal`;

  try {
    // --- Cleanup any leftover E2E seed data from previous interrupted runs ---
    await cleanupStaleSeedData(prisma);

    // --- Create isolated branch ---
    const branch = await prisma.branch.create({
      data: {
        code: branchCode,
        name: `E2E Test Branch ${timestamp}`,
        address: '1 Test Lane',
        phone: '0000000001',
        email: `branch-${timestamp}@e2e.internal`,
        isActive: true,
      },
    });

    // --- Resolve Super Admin role (must already exist from seeds) ---
    const role = await prisma.role.findFirstOrThrow({
      where: { name: 'Super Admin' },
    });

    // --- Create isolated test user (no firebaseUid — cannot authenticate via Firebase) ---
    // This user represents the test subject for data-creation but is NOT used for
    // browser authentication. Tests that require authenticated browser sessions must
    // provide their own Firebase credentials via env vars.
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        firstName: 'E2E',
        lastName: 'Seed',
        roleId: role.id,
        branchId: branch.id,
        emailVerified: false,
        isActive: true,
        // firebaseUid intentionally NOT set — this user cannot log in
      },
    });

    // --- POS test data ---
    const posProduct = await prisma.product.create({
      data: {
        name: `E2E Test Product ${timestamp}`,
        sku: `E2E-SKU-${timestamp}`,
        description: 'E2E test product — safe to delete',
        sellingPrice: 99.99,
      },
    });

    const posCustomer = await prisma.customer.create({
      data: {
        firstName: 'E2E',
        lastName: 'POS Customer',
        email: `pos-customer-${timestamp}@e2e.internal`,
        phone: '0000000002',
        createdById: user.id,
      },
    });

    // Create BranchStock so the product appears as in-stock
    await prisma.branchStock.create({
      data: {
        branchId: branch.id,
        productId: posProduct.id,
        onHand: 100,
        reorderLevel: 5,
      },
    });

    // --- Portal test data ---
    const portalCustomerEmail = `portal-customer-${timestamp}@e2e.internal`;
    const portalCustomer = await prisma.customer.create({
      data: {
        firstName: 'E2E',
        lastName: 'Portal Customer',
        email: portalCustomerEmail,
        phone: '0000000003',
        createdById: user.id,
      },
    });

    const portalQuotationToken = `e2e-portal-token-${timestamp}`;
    const portalQuotation = await prisma.quotation.create({
      data: {
        documentNumber: `QT-E2E-${timestamp}`,
        status: 'SENT',
        subtotal: 150,
        taxAmount: 0,
        total: 150,
        portalToken: portalQuotationToken,
        branchId: branch.id,
        createdById: user.id,
        customerId: portalCustomer.id,
      },
    });

    // --- Write state file ---
    const state: E2EState = {
      branchId: branch.id,
      userId: user.id,
      userEmail: user.email,
      posProductId: posProduct.id,
      posProductSku: posProduct.sku,
      posCustomerId: posCustomer.id,
      portalQuotationId: portalQuotation.id,
      portalQuotationToken: portalQuotationToken,
      portalCustomerId: portalCustomer.id,
      portalCustomerEmail: portalCustomerEmail,
    };

    mkdirSync(join(__dirname), { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

    console.log(
      `\n[E2E globalSetup] ✓ Seeded isolated test data (branch: ${branchCode})`
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Remove any leftover E2E seed records from previous interrupted runs.
 * Identified by the branch code prefix and user email prefix.
 */
async function cleanupStaleSeedData(prisma: PrismaClient) {
  const staleBranches = await prisma.branch.findMany({
    where: { code: { startsWith: SEED_BRANCH_CODE_PREFIX } },
    select: { id: true },
  });

  for (const { id: branchId } of staleBranches) {
    await prisma.sale.deleteMany({ where: { branchId } });
    await prisma.quotation.deleteMany({ where: { branchId } });
    await prisma.repair.deleteMany({ where: { branchId } });
    await prisma.branchStock.deleteMany({ where: { branchId } });
  }

  // Find stale users to safely delete their dependencies
  const staleUsers = await prisma.user.findMany({
    where: { email: { startsWith: SEED_EMAIL_PREFIX } },
    select: { id: true },
  });

  for (const { id: userId } of staleUsers) {
    await prisma.customer.deleteMany({ where: { createdById: userId } });
    await prisma.quotation.deleteMany({ where: { createdById: userId } });
    await prisma.sale.deleteMany({ where: { createdById: userId } });
    await prisma.user.delete({ where: { id: userId } });
  }

  // Delete orphaned customers just in case
  await prisma.customer.deleteMany({
    where: { email: { endsWith: '@e2e.internal' } },
  });

  await prisma.product.deleteMany({
    where: { sku: { startsWith: 'E2E-SKU-' } },
  });

  for (const { id: branchId } of staleBranches) {
    await prisma.branch.delete({ where: { id: branchId } });
  }
}
