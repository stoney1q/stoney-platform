import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT } from './route';
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

describe('Repair By ID API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new (await import('@/lib/auth/guard')).AuthError('Auth', 401, 'UNAUTHORIZED'));
    const req = new NextRequest('http://localhost:3000/api/v1/repairs/1');
    const res = await GET(req, { params: Promise.resolve({ id: '1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 for missing repair', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ id: 'user-1', branchId: 'b1' } as unknown as never);
    vi.mocked(requirePermission).mockResolvedValue({} as unknown as never);
    const req = new NextRequest('http://localhost:3000/api/v1/repairs/missing-id');
    const res = await GET(req, { params: Promise.resolve({ id: 'missing-id' }) });
    expect(res.status).toBe(404);
  });

  it('returns repair data and sanitizes DTO', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const branch = await prisma.branch.create({
      data: {
        name: `Branch Rep ID ${suffix}`,
        code: `TB-RID-${suffix}`,
      },
    });

    const role = await prisma.role.create({
      data: {
        name: `Role Rep ID ${suffix}`,
      },
    });

    const user = await prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'User',
        email: `rep-id-user-${suffix}@example.com`,
        role: { connect: { id: role.id } },
        branch: { connect: { id: branch.id } },
      },
    });

    const customer = await prisma.customer.create({
      data: {
        firstName: 'Cust',
        lastName: 'Api',
        email: `cust-${suffix}@example.com`,
        phone: '123456',
        createdById: user.id,
      },
    });

    const device = await prisma.device.create({
      data: {
        customerId: customer.id,
        make: 'Apple',
        model: 'iPhone 15',
        serialNumber: `SN-${suffix}`,
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

    const req = new NextRequest(`http://localhost:3000/api/v1/repairs/${repair.id}`);
    const res = await GET(req, { params: Promise.resolve({ id: repair.id }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    const returnedRepair = body.data.repair;
    expect(returnedRepair).toHaveProperty('id', repair.id);
    expect(returnedRepair).not.toHaveProperty('version');
    expect(returnedRepair).not.toHaveProperty('updatedAt');
    expect(returnedRepair).toHaveProperty('issue', 'Broken Screen');

    // Test PUT status update
    const putReq = new NextRequest(`http://localhost:3000/api/v1/repairs/${repair.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status: RepairStatus.DIAGNOSING,
        version: repair.version,
        notes: 'In progress',
      }),
    });
    const putRes = await PUT(putReq, { params: Promise.resolve({ id: repair.id }) });
    expect(putRes.status).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.data.repair.status).toBe(RepairStatus.DIAGNOSING);

    // Cleanup
    await prisma.repairLog.deleteMany({ where: { repairId: repair.id } });
    await prisma.repair.delete({ where: { id: repair.id } });
    await prisma.device.delete({ where: { id: device.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.role.delete({ where: { id: role.id } });
    await prisma.branch.delete({ where: { id: branch.id } });
  });
});
