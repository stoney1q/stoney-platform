import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { requireAuth, requirePermission, requireBranchAccess } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { QuotationStatus } from '@/generated/prisma/client';

vi.mock('@/lib/auth/guard', async () => {
  return {
    requireAuth: vi.fn(),
    requirePermission: vi.fn(),
    requireBranchAccess: vi.fn(),
    AuthError: class AuthError extends Error {
      constructor(message: string, public statusCode: number, public code: string) {
        super(message);
      }
    },
  };
});

describe('Quotations API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Auth', 401, 'UNAUTHORIZED'));
    const req = new NextRequest('http://localhost:3000/api/v1/quotations');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('rejects POST with invalid body', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', branchId: 'b1', role: { name: 'User' }, permissions: [] } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    const req = new NextRequest('http://localhost:3000/api/v1/quotations', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns paginated quotations', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const branch = await prisma.branch.create({
      data: {
        name: `Branch Quote ${suffix}`,
        code: `TB-QT-${suffix}`,
      },
    });

    const role = await prisma.role.create({
      data: {
        name: `Role Quote ${suffix}`,
      },
    });

    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: `quote-user-${suffix}@example.com`,
        role: { connect: { id: role.id } },
        branch: { connect: { id: branch.id } },
      },
    });

    const customer = await prisma.customer.create({
      data: {
        firstName: 'Test',
        lastName: 'Customer',
        createdById: user.id,
      },
    });

    const quotation = await prisma.quotation.create({
      data: {
        branchId: branch.id,
        customerId: customer.id,
        createdById: user.id,
        subtotal: 100,
        total: 100,
        status: QuotationStatus.DRAFT,
      },
    });

    vi.mocked(requireAuth).mockResolvedValue({
      id: user.id,
      branchId: branch.id,
      role: { name: 'User' },
      permissions: [],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    vi.mocked(requireBranchAccess).mockResolvedValue({} as unknown as never);

    const req = new NextRequest(`http://localhost:3000/api/v1/quotations`);
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.quotations.length).toBeGreaterThanOrEqual(1);
    const returnedQuotation = body.data.quotations.find((q: { id: string }) => q.id === quotation.id);
    expect(returnedQuotation).toBeDefined();

    // Ensure createdById and updatedAt are stripped
    expect(returnedQuotation).not.toHaveProperty('createdById');
    expect(returnedQuotation).not.toHaveProperty('updatedAt');
    expect(returnedQuotation).toHaveProperty('status', QuotationStatus.DRAFT);
    expect(body.data.pagination.limit).toBe(20);

    // Cleanup
    await prisma.quotation.delete({ where: { id: quotation.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.branch.delete({ where: { id: branch.id } });
  });

  it('returns requested pagination limit in metadata', async () => {
    vi.mocked(requireAuth).mockResolvedValue({
      id: 'test-user',
      branchId: 'b1',
      role: { name: 'User' },
      permissions: [],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    vi.mocked(requireBranchAccess).mockResolvedValue({} as unknown as never);

    const req = new NextRequest('http://localhost:3000/api/v1/quotations?limit=25');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pagination.limit).toBe(25);
  });

  it('creates a quotation via POST', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const branch = await prisma.branch.create({
      data: {
        name: `Branch Quote POST ${suffix}`,
        code: `TB-QTP-${suffix}`,
      },
    });

    const role = await prisma.role.create({
      data: {
        name: `Role Quote POST ${suffix}`,
      },
    });

    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: `quote-post-${suffix}@example.com`,
        role: { connect: { id: role.id } },
        branch: { connect: { id: branch.id } },
      },
    });

    const customer = await prisma.customer.create({
      data: {
        firstName: 'Test',
        lastName: 'Customer',
        createdById: user.id,
      },
    });

    vi.mocked(requireAuth).mockResolvedValue({
      id: user.id,
      branchId: branch.id,
      role: { name: 'User' },
      permissions: [],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);

    const req = new NextRequest('http://localhost:3000/api/v1/quotations', {
      method: 'POST',
      body: JSON.stringify({ customerId: customer.id }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.quotation).toBeDefined();
    expect(body.data.quotation.customerId).toBe(customer.id);
    expect(body.data.quotation).not.toHaveProperty('createdById');

    // Cleanup
    await prisma.quotation.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.branch.delete({ where: { id: branch.id } });
  });
});
