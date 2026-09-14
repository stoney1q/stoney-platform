import 'dotenv/config';
import { vi } from 'vitest';

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
