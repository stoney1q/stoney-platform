import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock cookies based on a simple global state we can change per test
const { currentMockCookie } = vi.hoisted(() => ({
  currentMockCookie: { value: undefined as string | undefined },
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      if (name === 'stoney_session' && currentMockCookie.value !== undefined) {
        return { value: currentMockCookie.value };
      }
      return undefined;
    },
  }),
}));

vi.mock('../firebase/admin', () => ({
  isFirebaseAdminConfigured: () => true,
  getFirebaseAdminAuth: () => ({
    verifySessionCookie: async () => {
      if (currentMockCookie.value === 'active_manager') {
        return { uid: 'manager_uid', email: 'manager@test.com' };
      }
      if (currentMockCookie.value === 'active_cashier') {
        return { uid: 'cashier_uid', email: 'cashier@test.com' };
      }
      throw new Error('auth/invalid-session-cookie');
    },
  }),
}));

describe('Dashboard Queries', async () => {
  const { getRevenueMetrics } = await import('./queries');

  beforeEach(() => {
    currentMockCookie.value = undefined;
  });

  it('blocks unauthorized access to revenue metrics', async () => {
    // cashier doesn't have dashboard:revenue:read by default in our mock setup
    currentMockCookie.value = 'active_cashier';

    await expect(getRevenueMetrics()).rejects.toThrow('Access denied');
  });

  // Note: More comprehensive integration tests require a running test DB
  // and seeding data, which we defer to the E2E/integration suites.
});
