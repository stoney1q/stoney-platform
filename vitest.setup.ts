import 'dotenv/config';
import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// TEST ENVIRONMENT SAFETY GUARD
// ---------------------------------------------------------------------------
// Force integration tests to use the explicit test database, not production.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
} else if (
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost') &&
  !process.env.DATABASE_URL.includes('127.0.0.1')
) {
  // If no TEST_DATABASE_URL is provided, and DATABASE_URL looks like a remote 
  // (potentially production) database, abort immediately.
  throw new Error(
    'VITEST ABORTED: DATABASE_URL appears to be a remote/production database. ' +
    'To run integration tests locally, you MUST set TEST_DATABASE_URL in your .env ' +
    'pointing to an isolated test database.'
  );
}
// ---------------------------------------------------------------------------

// Mock server-only to prevent it from throwing in Vitest Node environment
vi.mock('server-only', () => ({}));

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (callback: () => void) => {
      // Execute the callback immediately in tests, as Next.js RequestContext is unavailable
      callback();
    },
  };
});
