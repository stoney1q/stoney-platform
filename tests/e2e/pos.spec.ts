/**
 * pos.spec.ts — POS Sale Flow E2E tests
 *
 * Tests that POS pages are correctly protected and not accessible to
 * unauthenticated users. Authenticated POS flows require real Firebase
 * credentials and are deferred to a future loop with test account support.
 */
import { test, expect } from './setup';

test.describe('POS Sale Flow', () => {
  test('unauthenticated access to /sales is redirected to login', async ({
    page,
  }) => {
    await page.goto('/sales');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('unauthenticated access to /sales/new is redirected to login', async ({
    page,
  }) => {
    await page.goto('/sales/new');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('E2E seed data was created with isolated branch', async ({
    e2eState,
  }) => {
    // Verify the globalSetup seeded the expected data.
    // This confirms the Prisma-based globalSetup works correctly.
    expect(e2eState.branchId).toBeTruthy();
    expect(e2eState.userId).toBeTruthy();
    expect(e2eState.posProductId).toBeTruthy();
    expect(e2eState.posProductSku).toMatch(/^E2E-SKU-/);
    expect(e2eState.posCustomerId).toBeTruthy();
  });
});
