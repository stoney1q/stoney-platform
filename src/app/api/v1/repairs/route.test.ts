import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from './route';
import { requireAuth, requirePermission, requireBranchAccess } from '@/lib/auth/guard';
import prisma from '@/lib/prisma';
import { RepairStatus } from '@/generated/prisma/client';

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

describe('Repairs API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Auth', 401, 'UNAUTHORIZED'));
    const req = new NextRequest('http://localhost:3000/api/v1/repairs');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('rejects POST with invalid body', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', branchId: 'b1', role: { name: 'User' }, permissions: [] } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    const req = new NextRequest('http://localhost:3000/api/v1/repairs', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns paginated repairs', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const branch = await prisma.branch.create({
      data: {
        name: `Branch Rep ${suffix}`,
        code: `TB-RP-${suffix}`,
      },
    });

    const role = await prisma.role.create({
      data: {
        name: `Role Rep ${suffix}`,
      },
    });

    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: `rep-user-${suffix}@example.com`,
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

    const device = await prisma.device.create({
      data: {
        customerId: customer.id,
        make: 'Apple',
        model: 'iPhone 13',
      },
    });

    const repair = await prisma.repair.create({
      data: {
        branchId: branch.id,
        customerId: customer.id,
        deviceId: device.id,
        issue: 'Broken Screen',
        status: RepairStatus.RECEIVED,
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

    const req = new NextRequest(`http://localhost:3000/api/v1/repairs`);
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.data.repairs.length).toBeGreaterThanOrEqual(1);
    const returnedRepair = body.data.repairs.find((r: { id: string }) => r.id === repair.id);
    expect(returnedRepair).toBeDefined();

    // Ensure version and updatedAt are stripped
    expect(returnedRepair).not.toHaveProperty('version');
    expect(returnedRepair).not.toHaveProperty('updatedAt');
    expect(returnedRepair).toHaveProperty('issue', 'Broken Screen');
    expect(body.data.pagination.limit).toBe(20);

    // Cleanup
    await prisma.repair.delete({ where: { id: repair.id } });
    await prisma.device.delete({ where: { id: device.id } });
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

    const req = new NextRequest('http://localhost:3000/api/v1/repairs?limit=15');
    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.pagination.limit).toBe(15);
  });

  it('creates a repair ticket via POST', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const branch = await prisma.branch.create({
      data: {
        name: `Branch Rep POST ${suffix}`,
        code: `TB-RPP-${suffix}`,
      },
    });

    const role = await prisma.role.create({
      data: {
        name: `Role Rep POST ${suffix}`,
      },
    });

    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: `rep-post-${suffix}@example.com`,
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

    const device = await prisma.device.create({
      data: {
        customerId: customer.id,
        make: 'Google',
        model: 'Pixel 8',
      },
    });

    vi.mocked(requireAuth).mockResolvedValue({
      id: user.id,
      branchId: branch.id,
      role: { name: 'User' },
      permissions: [],
    } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);

    const req = new NextRequest('http://localhost:3000/api/v1/repairs', {
      method: 'POST',
      body: JSON.stringify({
        customerId: customer.id,
        deviceId: device.id,
        issue: 'Battery drain',
        notes: 'Drains in 2 hours',
      }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.repair).toBeDefined();
    expect(body.data.repair.issue).toBe('Battery drain');
    expect(body.data.repair).not.toHaveProperty('version');

    // Cleanup
    await prisma.repairLog.deleteMany({ where: { repairId: body.data.repair.id } });
    await prisma.repair.delete({ where: { id: body.data.repair.id } });
    await prisma.device.delete({ where: { id: device.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.branch.delete({ where: { id: branch.id } });
  });
});
