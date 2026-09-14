import {
  describe,
  it,
  beforeAll,
  afterAll,
  beforeEach,
  expect,
  vi,
} from 'vitest';
import prisma from '@/lib/prisma';
import {
  generateDocumentNumber,
  enqueueDocumentEmail,
  regenerateDocumentPdfAction,
} from './actions';
import * as actions from './actions';
import { generateDocumentPdf } from './pdf-generator';

vi.mock('@/lib/auth/guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    role: { name: 'Admin' },
    permissions: ['admin:global'],
  }),
  requireBranchAccess: vi.fn().mockResolvedValue(true),
  requirePermission: vi.fn().mockResolvedValue({ id: 'test_doc_user_uid' }),
}));

describe('Document Actions', () => {
  let mainBranchId: string;
  let testDocumentId: string;

  beforeAll(async () => {
    // Cleanup
    await prisma.emailDeliveryLog.deleteMany();
    await prisma.branchSequence.deleteMany();
    await prisma.sale.deleteMany({
      where: { customer: { email: 'test@email.com' } },
    });
    await prisma.customer.deleteMany({ where: { email: 'test@email.com' } });

    // Setup branch
    let branch = await prisma.branch.findFirst({ where: { code: 'MAIN' } });
    if (!branch) {
      branch = await prisma.branch.create({
        data: { name: 'Main Branch', code: 'MAIN', address: '123 Main St' },
      });
    }
    mainBranchId = branch.id;

    let user = await prisma.user.findFirst({
      where: { email: 'test_doc_user@example.com' },
    });
    if (!user) {
      const role =
        (await prisma.role.findFirst()) ||
        (await prisma.role.create({ data: { name: 'Admin' } }));
      user = await prisma.user.create({
        data: {
          email: 'test_doc_user@example.com',
          firstName: 'Test',
          lastName: 'User',
          firebaseUid: 'test_doc_user_uid',
          branchId: mainBranchId,
          roleId: role.id,
        },
      });
    }

    // Create a dummy sale to attach emails to
    const customer = await prisma.customer.create({
      data: {
        firstName: 'Test',
        lastName: 'Customer',
        email: 'test@email.com',
        createdById: user.id,
      },
    });

    const sale = await prisma.sale.create({
      data: {
        branchId: mainBranchId,
        customerId: customer.id,
        createdById: user.id,
        subtotal: 100,
        taxAmount: 10,
        total: 110,
      },
    });
    testDocumentId = sale.id;
  });

  afterAll(async () => {
    await prisma.emailDeliveryLog.deleteMany();
    await prisma.branchSequence.deleteMany();
    await prisma.sale.deleteMany({ where: { id: testDocumentId } });
    await prisma.customer.deleteMany({ where: { email: 'test@email.com' } });
    await prisma.user.deleteMany({
      where: { email: 'test_doc_user@example.com' },
    });
  });

  describe('BranchSequence', () => {
    beforeEach(async () => {
      await prisma.branchSequence.deleteMany();
    });

    it('should handle concurrent first-time BranchSequence creation safely', async () => {
      // Run 5 concurrent generateDocumentNumber calls on a non-existent sequence
      const promises = Array.from({ length: 5 }).map(() =>
        prisma.$transaction(async (tx) => {
          return generateDocumentNumber(tx, mainBranchId, 'INV');
        })
      );

      const results = await Promise.all(promises);

      // Verify they are unique
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(5);

      // Verify they are sequential 1 to 5
      expect(results).toContain('INV-MAIN-00001');
      expect(results).toContain('INV-MAIN-00002');
      expect(results).toContain('INV-MAIN-00003');
      expect(results).toContain('INV-MAIN-00004');
      expect(results).toContain('INV-MAIN-00005');
    });

    it('should handle concurrent BranchSequence increments safely', async () => {
      // Pre-create the sequence
      await prisma.branchSequence.create({
        data: {
          branchId: mainBranchId,
          prefix: 'REP',
          currentValue: 10,
        },
      });

      // Run 5 concurrent increments
      const promises = Array.from({ length: 5 }).map(() =>
        prisma.$transaction(async (tx) => {
          return generateDocumentNumber(tx, mainBranchId, 'REP');
        })
      );

      const results = await Promise.all(promises);

      // Verify they are unique
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(5);

      // Verify they are sequential 11 to 15
      expect(results).toContain('REP-MAIN-00011');
      expect(results).toContain('REP-MAIN-00015');
    });
  });

  describe('EmailDeliveryLog', () => {
    beforeEach(async () => {
      await prisma.emailDeliveryLog.deleteMany({
        where: {
          email: { in: ['actions-test@example.com', 'concurrent@example.com'] },
        },
      });
    });

    it('should ensure SENT EmailDeliveryLog cannot become PENDING', async () => {
      const email = 'actions-test@example.com';
      const type = 'SALE';
      const key = `${type}_${testDocumentId}_${email}`;

      // 1. Initial enqueue
      await enqueueDocumentEmail(testDocumentId, email, type);

      let log = await prisma.emailDeliveryLog.findUnique({
        where: { idempotencyKey: key },
      });
      expect(log?.status).toBe('PENDING');

      // 2. Simulate background worker marking it SENT
      await prisma.emailDeliveryLog.update({
        where: { idempotencyKey: key },
        data: { status: 'SENT' },
      });

      // 3. Attempt to enqueue again
      await enqueueDocumentEmail(testDocumentId, email, type);

      // 4. Verify it is still SENT
      log = await prisma.emailDeliveryLog.findUnique({
        where: { idempotencyKey: key },
      });
      expect(log?.status).toBe('SENT');
    });

    it('should handle concurrent duplicate email enqueue requests safely', async () => {
      const email = 'concurrent@example.com';
      const type = 'SALE';
      const key = `${type}_${testDocumentId}_${email}`;

      // Run 5 concurrent enqueues
      const promises = Array.from({ length: 5 }).map(() =>
        enqueueDocumentEmail(testDocumentId, email, type)
      );

      await Promise.all(promises);

      // Verify only 1 log was created and it's PENDING
      const logs = await prisma.emailDeliveryLog.findMany({
        where: { idempotencyKey: key },
      });
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('PENDING');
    });
    it('should enforce cross-branch authorization for getDocumentDeliveryLogs', async () => {
      const { requireAuth, requireBranchAccess } =
        await import('@/lib/auth/guard');

      // Mock requireAuth to return a regular user without global admin
      (requireAuth as any).mockResolvedValueOnce({
        role: { name: 'Staff' },
        permissions: [],
      });

      const { getDocumentDeliveryLogs } = await import('./actions');

      // Simulate requireBranchAccess throwing an error for a branch mismatch
      (requireBranchAccess as any).mockRejectedValueOnce(
        new Error('Access denied to branch')
      );

      await expect(getDocumentDeliveryLogs(testDocumentId)).rejects.toThrow(
        'Access denied to branch'
      );
    });
  });

  describe('PDF Security', () => {
    it('should not expose generateDocumentPdf as a server action in actions.ts', () => {
      // @ts-expect-error - We are specifically testing that this is NOT exported from the Server Action file
      expect(actions.generateDocumentPdf).toBeUndefined();
    });

    it('should export regenerateDocumentPdfAction as the authorized server action', () => {
      expect(typeof regenerateDocumentPdfAction).toBe('function');
    });

    it('should have the internal generator available in the safe module', () => {
      expect(typeof generateDocumentPdf).toBe('function');
    });
  });
});
