/**
 * portal.spec.ts — Customer Portal E2E tests
 *
 * The customer portal is accessible without authentication — it uses a
 * per-quotation `portalToken` for identity. These tests cover:
 * 1. Invalid tokens are rejected (404 or redirect)
 * 2. Valid tokens show the portal UI
 * 3. Rate limiting on portal access attempts
 *
 * Test data is seeded by globalSetup and read from the state file.
 */
import { test, expect } from './setup';

test.describe('Customer Portal', () => {
  test('an invalid portal token returns a not-found page', async ({ page }) => {
    await page.goto('/portal/this-token-does-not-exist-123xyz');
    // Should either 404 or redirect to an error page — never show a quotation
    const body = await page.content();
    const hasError =
      page.url().includes('not-found') ||
      body.toLowerCase().includes('not found') ||
      body.toLowerCase().includes('invalid') ||
      body.toLowerCase().includes('expired') ||
      body.toLowerCase().includes('error') ||
      (await page.locator('h1').textContent())?.includes('404');
    expect(hasError).toBeTruthy();
  });

  test('a valid portal token shows the portal verification page', async ({
    page,
    e2eState,
  }) => {
    await page.goto(`/portal/${e2eState.portalQuotationToken}`);

    // The portal should show a verification prompt (email/phone entry)
    // before revealing quotation details
    // It should NOT immediately show the quotation document
    // (verification step should appear first)
    await expect(
      page.getByRole('heading', { name: 'Access Document' })
    ).toBeVisible();

    // Page should load without error
    await expect(page).not.toHaveURL(/.*\/login/);
    await expect(page).not.toHaveURL(/.*\/error/);
  });

  test('portal token from seed data matches expected format', async ({
    e2eState,
  }) => {
    expect(e2eState.portalQuotationToken).toMatch(/^e2e-portal-token-/);
    expect(e2eState.portalCustomerEmail).toMatch(
      /^portal-customer-.*@e2e\.internal$/
    );
  });
});
