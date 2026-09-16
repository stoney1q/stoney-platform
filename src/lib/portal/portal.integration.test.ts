import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { verifyPortalAccess, customerAcceptQuotation } from './actions';
import {
  checkPortalRateLimit,
  resetPortalRateLimits,
  cleanupPortalRateLimits,
} from './rate-limit';
import { secureCompare, setPortalCookie } from './auth';
import { prisma } from '../prisma';

vi.mock('./auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./auth')>();
  return {
    ...actual,
    signPortalToken: vi.fn().mockResolvedValue('mock-jwt'),
    setPortalCookie: vi.fn(),
    verifyPortalCookie: vi
      .fn()
      .mockResolvedValue({
        portalToken: 'test-token',
        type: 'QUOTATION',
        documentId: 'test-quotation-id',
      }),
  };
});

vi.mock('next/headers', () => ({
  headers: () => ({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}));

describe('Portal Integration', () => {
  beforeEach(() => {
    resetPortalRateLimits();
    vi.clearAllMocks();
  });

  describe('Contact Verification (secureCompare)', () => {
    it('returns constant-time matching for correct lengths', () => {
      // Not a real timing test, just testing the logic
      expect(secureCompare('1234567890', '1234567890')).toBe(true);
      expect(secureCompare('1234567890', '0987654321')).toBe(false);
    });

    it('handles null values safely without throwing errors', () => {
      expect(secureCompare('1234567890', null)).toBe(false);
    });

    it('handles length mismatches without throwing errors', () => {
      expect(secureCompare('12345', '1234567890')).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('blocks IPs that exceed the 5 request limit', () => {
      for (let i = 0; i < 5; i++) {
        expect(checkPortalRateLimit('192.168.1.1', 'token-a')).toBe(true);
      }
      // 6th attempt should fail
      expect(checkPortalRateLimit('192.168.1.1', 'token-a')).toBe(false);
    });

    it('blocks global tokens that exceed the 10 request limit across IPs', () => {
      for (let i = 0; i < 10; i++) {
        expect(checkPortalRateLimit(`10.0.0.${i}`, 'token-b')).toBe(true);
      }
      // 11th attempt from a new IP should fail for the same token
      expect(checkPortalRateLimit('10.0.0.11', 'token-b')).toBe(false);
    });

    it('does not permanently accumulate requests for low-frequency users (fixed window fix)', () => {
      // 15 minute window for IPs
      for (let i = 0; i < 4; i++) {
        expect(checkPortalRateLimit('192.168.1.2', 'token-c')).toBe(true);
        // Advance time by 14 minutes (less than the 15 min window, but over time exceeds it)
        vi.advanceTimersByTime(14 * 60 * 1000);
      }
      // Previously, with lastAttempt, the 4th request at 42m would be fine. The 5th at 56m would be fine. The 6th at 70m would block.
      // With fixed windowStart, after 15m the window should reset.
      // The loops above advance time 14m * 4 = 56m total.
      // So we have made 4 requests spanning 56 minutes. We should not be blocked on the next request.
      expect(checkPortalRateLimit('192.168.1.2', 'token-c')).toBe(true);
      // And we should be able to make 4 more requests in the current window!
      for (let i = 0; i < 4; i++) {
        expect(checkPortalRateLimit('192.168.1.2', 'token-c')).toBe(true);
      }
      // But a 6th request in the SAME window should fail
      expect(checkPortalRateLimit('192.168.1.2', 'token-c')).toBe(false);
    });

    it('cleans up expired records', () => {
      expect(checkPortalRateLimit('192.168.1.3', 'token-d')).toBe(true);
      // Advance by 20 minutes (exceeds 15m IP window)
      vi.advanceTimersByTime(20 * 60 * 1000);
      cleanupPortalRateLimits();
      // If we could inspect the maps, they would be empty.
      // We can infer cleanup works if we can make 5 more requests without being blocked.
      for (let i = 0; i < 5; i++) {
        expect(checkPortalRateLimit('192.168.1.3', 'token-d')).toBe(true);
      }
    });
  });

  describe('Phone Normalization & Security', () => {
    it('strips non-digits during verification', async () => {
      // Mock prisma findUnique to return a record
      const mockQuotation = {
        id: 'test-quotation-id',
        portalToken: 'test-token',
        customer: { email: null, phone: '5551234567' },
      };

      vi.spyOn(prisma.quotation, 'findUnique').mockResolvedValue(
        mockQuotation as any
      );

      const res = await verifyPortalAccess('test-token', '(555) 123-4567');
      expect(res.success).toBe(true);
      expect(setPortalCookie).toHaveBeenCalled();
    });

    it('prevents authentication bypass with empty string inputs matching empty DB fields', async () => {
      const mockQuotation = {
        id: 'test-quotation-id-empty',
        portalToken: 'test-token-empty',
        customer: { email: '', phone: '' },
      };

      vi.spyOn(prisma.quotation, 'findUnique').mockResolvedValue(
        mockQuotation as any
      );

      // Providing an empty string, or whitespace, or just symbols should NOT authenticate
      // if the DB also has empty strings.

      // Attempt 1: Whitespace email
      const res1 = await verifyPortalAccess('test-token-empty', '   ');
      expect(res1.success).toBe(true); // Always returns success:true to prevent enumeration
      expect(setPortalCookie).not.toHaveBeenCalled(); // But should NOT set cookie

      // Attempt 2: Only non-digits for phone
      const res2 = await verifyPortalAccess('test-token-empty', 'abc-def');
      expect(res2.success).toBe(true);
      expect(setPortalCookie).not.toHaveBeenCalled();
    });
  });

  describe('Quotation Concurrency', () => {
    it('throws DOCUMENT_MODIFIED when version mismatches', async () => {
      const mockQuotation = {
        id: 'test-quotation-id',
        status: 'SENT',
        version: 2,
      };

      vi.spyOn(prisma.quotation, 'findUnique').mockResolvedValue(
        mockQuotation as any
      );

      // Simulate Prisma P2025 error on update
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to update not found.',
        {
          code: 'P2025',
          clientVersion: '7.9.1',
        }
      );

      const mockUpdate = vi.fn().mockRejectedValue(prismaError);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({ quotation: { update: mockUpdate } });
      });

      await expect(customerAcceptQuotation('test-token', 1)).rejects.toThrow(
        'DOCUMENT_MODIFIED'
      );
    });
  });
});
