import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from './route';
import { prisma } from '@/lib/prisma';
import { sendDocumentEmail } from '@/lib/documents/email';

// Mock the dependencies
vi.mock('@/lib/documents/email', () => ({
  sendDocumentEmail: vi.fn(),
}));

vi.mock('@/lib/media/storage', () => ({
  storage: {
    generatePresignedDownloadUrl: vi
      .fn()
      .mockResolvedValue('https://mocked-signed-url.com/doc.pdf'),
  },
}));

describe('Process Emails Cron Job', () => {
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(async () => {
    process.env.CRON_SECRET = 'test-secret';
    await prisma.emailDeliveryLog.deleteMany({
      where: { email: 'test@example.com' },
    });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    process.env.CRON_SECRET = originalCronSecret;
  });

  it('rejects requests when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const req = new Request('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('rejects requests without valid auth header', async () => {
    const req = new Request('http://localhost:3000/api/cron/process-emails');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('rejects requests with incorrect auth header', async () => {
    const req = new Request('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns success message when no pending emails exist', async () => {
    const req = new Request('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.message).toBe('No pending emails to process.');
  });

  it('processes pending emails and marks them as SENT', async () => {
    const branchCode = 'TB-' + Math.random().toString(36).substring(7);
    const branch = await prisma.branch.create({
      data: { name: 'Test Branch', code: branchCode, email: 'tb@test.com' },
    });

    const role = await prisma.role.create({
      data: { name: 'Test Role - ' + Math.random().toString(36).substring(7) },
    });

    const user = await prisma.user.create({
      data: {
        email: `test-cron-user-${Math.random().toString(36).substring(7)}@stoney.com`,
        firstName: 'Cron',
        lastName: 'User',
        firebaseUid: `cron-uid-${Math.random().toString(36).substring(7)}`,
        roleId: role.id,
        branchId: branch.id,
      },
    });

    const customer = await prisma.customer.create({
      data: { firstName: 'John', lastName: 'Doe', createdById: user.id },
    });

    const sale = await prisma.sale.create({
      data: {
        documentNumber: 'SALE-' + Math.random().toString(36).substring(7),
        branchId: branch.id,
        customerId: customer.id,
        createdById: user.id,
        subtotal: 100,
        taxAmount: 10,
        total: 110,
        status: 'COMPLETED',
        documentMediaId: 'media-123',
      },
    });

    await prisma.emailDeliveryLog.create({
      data: {
        documentId: sale.id,
        email: 'test@example.com',
        idempotencyKey: `SALE_${sale.id}_test@example.com`,
        status: 'PENDING',
      },
    });

    const req = new Request('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.processed).toBe(1);
    expect(json.sent).toBe(1);
    expect(json.errors).toBe(0);

    expect(sendDocumentEmail).toHaveBeenCalledWith(
      sale.id,
      'test@example.com',
      'SALE',
      'https://mocked-signed-url.com/doc.pdf'
    );

    const log = await prisma.emailDeliveryLog.findFirst({
      where: { documentId: sale.id },
    });
    expect(log?.status).toBe('SENT');
  });

  it('marks log as ERROR if sending fails', async () => {
    const branchCode = 'TB-' + Math.random().toString(36).substring(7);
    const branch = await prisma.branch.create({
      data: { name: 'Test Branch', code: branchCode, email: 'tb@test.com' },
    });

    const role = await prisma.role.create({
      data: { name: 'Test Role - ' + Math.random().toString(36).substring(7) },
    });

    const user = await prisma.user.create({
      data: {
        email: `test-cron-user-${Math.random().toString(36).substring(7)}@stoney.com`,
        firstName: 'Cron',
        lastName: 'User',
        firebaseUid: `cron-uid-${Math.random().toString(36).substring(7)}`,
        roleId: role.id,
        branchId: branch.id,
      },
    });

    const customer = await prisma.customer.create({
      data: { firstName: 'John', lastName: 'Doe', createdById: user.id },
    });

    const sale = await prisma.sale.create({
      data: {
        documentNumber: 'SALE-' + Math.random().toString(36).substring(7),
        branchId: branch.id,
        customerId: customer.id,
        createdById: user.id,
        subtotal: 100,
        taxAmount: 10,
        total: 110,
        status: 'COMPLETED',
        documentMediaId: 'media-123',
      },
    });

    await prisma.emailDeliveryLog.create({
      data: {
        documentId: sale.id,
        email: 'test@example.com',
        idempotencyKey: `SALE_${sale.id}_test@example.com`,
        status: 'PENDING',
      },
    });

    vi.mocked(sendDocumentEmail).mockRejectedValueOnce(
      new Error('Resend API error')
    );

    const req = new Request('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.processed).toBe(1);
    expect(json.sent).toBe(0);
    expect(json.errors).toBe(1);

    const log = await prisma.emailDeliveryLog.findFirst({
      where: { documentId: sale.id },
    });
    expect(log?.status).toBe('ERROR');
    expect(log?.error).toBe('Email provider rejected the request');
  });

  it('reverts log to PENDING if sending fails with a transient error within 1 hour', async () => {
    const branchCode = 'TB-' + Math.random().toString(36).substring(7);
    const branch = await prisma.branch.create({
      data: { name: 'Test Branch', code: branchCode, email: 'tb@test.com' },
    });

    const role = await prisma.role.create({
      data: { name: 'Test Role - ' + Math.random().toString(36).substring(7) },
    });

    const user = await prisma.user.create({
      data: {
        email: `test-cron-user-${Math.random().toString(36).substring(7)}@stoney.com`,
        firstName: 'Cron',
        lastName: 'User',
        firebaseUid: `cron-uid-${Math.random().toString(36).substring(7)}`,
        roleId: role.id,
        branchId: branch.id,
      },
    });

    const customer = await prisma.customer.create({
      data: { firstName: 'John', lastName: 'Doe', createdById: user.id },
    });

    const sale = await prisma.sale.create({
      data: {
        documentNumber: 'SALE-' + Math.random().toString(36).substring(7),
        branchId: branch.id,
        customerId: customer.id,
        createdById: user.id,
        subtotal: 100,
        taxAmount: 10,
        total: 110,
        status: 'COMPLETED',
        documentMediaId: 'media-123',
      },
    });

    await prisma.emailDeliveryLog.create({
      data: {
        documentId: sale.id,
        email: 'test@example.com',
        idempotencyKey: `SALE_${sale.id}_test@example.com`,
        status: 'PENDING',
        createdAt: new Date(), // Fresh, so within 1 hour retry window
      },
    });

    vi.mocked(sendDocumentEmail).mockRejectedValueOnce(
      new Error('Resend rate limit exceeded (429)')
    );

    const req = new Request('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // It's not marked as an error in the response stats because it's a retry
    expect(json.success).toBe(true);

    const log = await prisma.emailDeliveryLog.findFirst({
      where: { documentId: sale.id },
    });
    // Should be PENDING again for next cron tick
    expect(log?.status).toBe('PENDING');
  });

  it('prevents concurrent cron executions from sending duplicate emails', async () => {
    const branchCode = 'TB-' + Math.random().toString(36).substring(7);
    const branch = await prisma.branch.create({
      data: { name: 'Test Branch', code: branchCode, email: 'tb@test.com' },
    });

    const role = await prisma.role.create({
      data: { name: 'Test Role - ' + Math.random().toString(36).substring(7) },
    });

    const user = await prisma.user.create({
      data: {
        email: `test-cron-user-${Math.random().toString(36).substring(7)}@stoney.com`,
        firstName: 'Cron',
        lastName: 'User',
        firebaseUid: `cron-uid-${Math.random().toString(36).substring(7)}`,
        roleId: role.id,
        branchId: branch.id,
      },
    });

    const customer = await prisma.customer.create({
      data: { firstName: 'John', lastName: 'Doe', createdById: user.id },
    });

    const sale = await prisma.sale.create({
      data: {
        documentNumber: 'SALE-' + Math.random().toString(36).substring(7),
        branchId: branch.id,
        customerId: customer.id,
        createdById: user.id,
        subtotal: 100,
        taxAmount: 10,
        total: 110,
        status: 'COMPLETED',
        documentMediaId: 'media-123',
      },
    });

    await prisma.emailDeliveryLog.create({
      data: {
        documentId: sale.id,
        email: 'test@example.com',
        idempotencyKey: `SALE_${sale.id}_test@example.com`,
        status: 'PENDING',
      },
    });

    const req1 = new Request('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });

    const req2 = new Request('http://localhost:3000/api/cron/process-emails', {
      headers: { authorization: 'Bearer test-secret' },
    });

    await Promise.all([GET(req1), GET(req2)]);

    expect(sendDocumentEmail).toHaveBeenCalledTimes(1);

    const log = await prisma.emailDeliveryLog.findFirst({
      where: { documentId: sale.id },
    });
    expect(log?.status).toBe('SENT');
  });
});
