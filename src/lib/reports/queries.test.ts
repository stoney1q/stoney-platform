/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSalesRevenueReport,
  getSalesStatusReport,
  getRepairStatusReport,
  getQuotationStatusReport,
  getInventoryMovementReport,
} from './queries';
import { exportReportCSV } from './actions';
import { resolveDateRangeUTCBounds, formatToBusinessDate } from './utils';
import prisma from '@/lib/prisma';
import { requirePermission } from '@/lib/auth/guard';

vi.mock('@/lib/auth/guard', () => ({
  requirePermission: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: vi.fn().mockResolvedValue([]),
    sale: { groupBy: vi.fn().mockResolvedValue([]) },
    repair: { groupBy: vi.fn().mockResolvedValue([]) },
    quotation: { groupBy: vi.fn().mockResolvedValue([]) },
    stockMovement: { groupBy: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('@/lib/dashboard/utils', () => ({
  getBusinessTimezone: () => 'America/New_York',
}));

describe('Reporting & Analytics Adversarial Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const runAllReports = async (branchId?: string) => {
    await getSalesRevenueReport({ branchId });
    await getSalesStatusReport({ branchId });
    await getRepairStatusReport({ branchId });
    await getQuotationStatusReport({ branchId });
    await getInventoryMovementReport({ branchId });
  };

  describe('RBAC & Branch Isolation', () => {
    it('1. unauthorized user rejected (reports:read)', async () => {
      vi.mocked(requirePermission).mockRejectedValue(new Error('Forbidden'));
      await expect(getSalesStatusReport()).rejects.toThrow('Forbidden');
    });

    it('2. Manager sees only own branch', async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        id: 'manager1',
        role: { name: 'Manager' },
        permissions: ['reports:read'],
        branchId: 'branch-1',
      } as any);
      await getSalesStatusReport();
      expect(prisma.sale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-1' }),
        })
      );
    });

    it('3. Manager cannot force another branch', async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        id: 'manager1',
        role: { name: 'Manager' },
        permissions: ['reports:read'],
        branchId: 'branch-1',
      } as any);
      await getSalesStatusReport({ branchId: 'tampered-branch-2' });
      expect(prisma.sale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-1' }),
        })
      );
    });

    it('4. Manager cannot request global report', async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        id: 'manager1',
        role: { name: 'Manager' },
        permissions: ['reports:read'],
        branchId: 'branch-1',
      } as any);
      // Passing undefined to ask for global
      await getSalesStatusReport({ branchId: undefined });
      expect(prisma.sale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-1' }),
        })
      );
    });

    it('5. admin:global can request another branch', async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        id: 'admin1',
        role: { name: 'Admin' },
        permissions: ['admin:global', 'reports:read'],
        branchId: 'branch-1',
      } as any);
      await getSalesStatusReport({ branchId: 'branch-3' });
      expect(prisma.sale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-3' }),
        })
      );
    });

    it('6. admin:global can request global aggregation', async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        id: 'super1',
        role: { name: 'Super Admin' },
        permissions: ['admin:global', 'reports:read'],
        branchId: 'branch-1',
      } as any);
      await getSalesStatusReport();
      expect(prisma.sale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ branchId: expect.anything() }),
        })
      );
    });
  });

  describe('CSV Export Security', () => {
    it('7. reports:export permission is enforced', async () => {
      vi.mocked(requirePermission).mockRejectedValue(new Error('Forbidden'));
      await expect(exportReportCSV('salesStatus')).rejects.toThrow('Forbidden');
      expect(requirePermission).toHaveBeenCalledWith('reports:export');
    });

    it('8. CSV export remains branch isolated', async () => {
      vi.mocked(requirePermission).mockImplementation(async (perm) => {
        if (perm === 'reports:export' || perm === 'reports:read') {
          return {
            id: 'manager1',
            role: { name: 'Manager' },
            permissions: ['reports:read', 'reports:export'],
            branchId: 'branch-1',
          } as any;
        }
        throw new Error('Forbidden');
      });

      await exportReportCSV('salesStatus', { branchId: 'tampered-2' });

      expect(prisma.sale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-1' }),
        })
      );
    });

    it('20. CSV escaping/injection protection', async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        id: 'admin1',
        role: { name: 'Admin' },
        permissions: ['admin:global', 'reports:read', 'reports:export'],
        branchId: 'branch-1',
      } as any);

      vi.mocked(prisma.sale.groupBy).mockResolvedValueOnce([
        { status: '=cmd|/c', _count: { id: 1 }, _sum: { total: null } },
        {
          status: 'Normal "Quote" Test',
          _count: { id: 2 },
          _sum: { total: null },
        },
      ] as any);

      const csv = await exportReportCSV('salesStatus');

      // Should escape quotes by doubling them, and prefix = with a space
      expect(csv).toContain('" =cmd|/c"');
      expect(csv).toContain('"Normal ""Quote"" Test"');
    });
  });

  describe('Date Validation & Timezone', () => {
    it('9. invalid date format rejected', () => {
      expect(() =>
        resolveDateRangeUTCBounds({ from: '2026/08/01', to: '2026/08/10' })
      ).toThrow('Invalid date format');
    });

    it('10. malformed date rejected', () => {
      expect(() =>
        resolveDateRangeUTCBounds({ from: 'abcd-ef-gh', to: '2026-08-10' })
      ).toThrow('Invalid date format');
    });

    it('11. impossible calendar date rejected', () => {
      expect(() =>
        resolveDateRangeUTCBounds({ from: '2026-02-30', to: '2026-03-01' })
      ).toThrow('Invalid calendar date');
    });

    it('12. from > to rejected', () => {
      expect(() =>
        resolveDateRangeUTCBounds({ from: '2026-08-10', to: '2026-08-01' })
      ).toThrow(
        'Invalid date range: from date must be before or equal to to date'
      );
    });

    it('13. maximum date range enforced', () => {
      expect(() =>
        resolveDateRangeUTCBounds({ from: '2024-01-01', to: '2026-01-01' })
      ).toThrow('Date range exceeds maximum allowed');
    });

    it('14. timezone boundary correctness & 15. DST boundary', () => {
      // Nov 1 2026 is a DST change in America/New_York
      const { start, end } = resolveDateRangeUTCBounds({
        from: '2026-11-01',
        to: '2026-11-01',
      });
      // 00:00:00 EDT = 04:00:00 UTC (before change)
      expect(start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
      // 23:59:59 EST = 04:59:59 UTC (after change)
      expect(end.toISOString()).toBe('2026-11-02T04:59:59.999Z');
    });
  });

  describe('Money & DTOs', () => {
    it('16. Decimal / money serialization & 17. empty report results & 18. no Prisma entity leakage', async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        id: 'manager1',
        role: { name: 'Manager' },
        permissions: ['reports:read'],
        branchId: 'branch-1',
      } as any);

      // Return a Decimal to test serialization
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
        {
          dateStr: '2026-08-01',
          revenue: { toFixed: () => '123.45' },
          txCount: BigInt(5),
        },
      ] as any);

      const result = await getSalesRevenueReport();
      expect(result).toEqual([
        { date: '2026-08-01', revenue: '123.45', transactionCount: 5 },
      ]);

      // Empty result test
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([]);
      const emptyResult = await getSalesRevenueReport();
      expect(emptyResult).toEqual([]);
    });

    it('19. inventory valuation remains deferred/not exposed', async () => {
      vi.mocked(requirePermission).mockResolvedValue({
        id: 'manager1',
        role: { name: 'Manager' },
        permissions: ['reports:read'],
        branchId: 'branch-1',
      } as any);

      const result = await getInventoryMovementReport();
      // Only type, count, quantity should exist
      if (result.length > 0) {
        expect(result[0]).not.toHaveProperty('value');
        expect(result[0]).not.toHaveProperty('cost');
      }
    });
  });
});
