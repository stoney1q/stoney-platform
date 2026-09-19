/**
 * E2E test fixtures.
 *
 * Reads shared E2E state seeded by globalSetup.
 * Does NOT create or delete any database records.
 * Does NOT inject authentication bypasses.
 *
 * Authenticated browser sessions are not supported in this suite — the
 * application uses HTTP-only session cookies tied to Firebase. Tests that
 * require post-authentication states should either:
 *   a) Mock at the API layer using msw (out of scope for Loop 35), or
 *   b) Use a real test Firebase account configured via E2E_* env vars.
 *
 * Current suite covers:
 *   - Unauthenticated redirect behaviour
 *   - Rate limiting on public endpoints
 *   - Public portal page access
 *   - POS page reachability (pre-auth redirect verification)
 */
import { test as base, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { E2EState, STATE_FILE } from './state';

function readState(): E2EState {
  if (!existsSync(STATE_FILE)) {
    throw new Error(
      '[E2E] State file not found. Did globalSetup run successfully?'
    );
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
}

export const test = base.extend<{
  e2eState: E2EState;
}>({
  e2eState: async ({}, use: (r: E2EState) => Promise<void>) => {
    const state = readState();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(state);
  },
});

export { expect };
