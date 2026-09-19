/**
 * auth.spec.ts — Authentication & Rate Limiting E2E tests
 *
 * Covers:
 * 1. Unauthenticated users are redirected to /login (no auth bypass possible)
 * 2. The test setup API does NOT exist in the application (backdoor removed)
 * 3. Rate limiting triggers on the /api/auth/session endpoint
 *    (NOTE: this test is skipped if RateLimit DB state from a previous run
 *    is still active. The rate limiter window is 15 minutes.)
 */
import { test, expect } from './setup';

test.describe('Authentication', () => {
  test('unauthenticated users are redirected to /login', async ({ page }) => {
    // Access a known protected route without any session cookie
    await page.goto('/sales');
    // Should land on /login (or /auth/login depending on redirect)
    await expect(page).toHaveURL(/.*\/login/);
    await expect(
      page.getByRole('heading', { name: 'Stoney Platform' })
    ).toBeVisible();
  });

  test('unauthenticated access to settings is redirected to /login', async ({
    page,
  }) => {
    await page.goto('/settings/staff');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('the e2e test setup API endpoint does not exist', async ({
    request,
  }) => {
    // Verify the backdoor has been removed — this must return 404
    const res = await request.post('/api/test/e2e-setup', {
      data: { action: 'setupAuth', payload: {} },
    });
    // Depending on Next.js dev vs start, a missing API route POST may return 404 or
    // it may render the HTML not-found page with a 200 status code.
    // If the endpoint actually existed, it would return JSON.
    const contentType = res.headers()['content-type'];
    expect(
      res.status() === 404 || contentType?.includes('text/html')
    ).toBeTruthy();
  });

  test('rate limiting triggers on excessive auth attempts', async ({
    request,
  }) => {
    // The rate limit is 10 requests per 15-minute window per IP.
    // We send 11 requests — the 11th should be rate-limited.
    // Note: if a previous run exhausted the window, this test's first
    // request may itself be rate-limited; skip in that case.
    const responses: number[] = [];

    for (let i = 0; i < 11; i++) {
      const res = await request.post('/api/auth/session', {
        data: { idToken: `fake-token-${i}` },
      });
      responses.push(res.status());
    }

    const firstResponse = responses[0];

    if (firstResponse === 429) {
      // Rate limit already active from a previous run — test is inconclusive but not a failure
      test.skip(
        true,
        'Rate limit window still active from previous test run; skipping'
      );
      return;
    }

    // First N requests should not be 429 (they'll be 400 or 401 because the token is fake)
    for (let i = 0; i < 10; i++) {
      expect(responses[i]).not.toBe(429);
    }

    // 11th request must be rate-limited
    expect(responses[10]).toBe(429);
  });
});
