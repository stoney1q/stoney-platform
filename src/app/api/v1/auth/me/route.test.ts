import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { requireAuth, AuthError } from '@/lib/auth/guard';

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn(),
  };
});

describe('Auth Me API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(
      new AuthError(
        'Authentication required. Please sign in to proceed.',
        401,
        'UNAUTHORIZED'
      )
    );

    const req = new NextRequest('http://localhost:3000/api/v1/auth/me');
    const res = await GET(req, {});

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe(
      'Authentication required. Please sign in to proceed.'
    );
  });

  it('returns sanitized user profile, active branch, role, and permissions', async () => {
    vi.mocked(requireAuth).mockResolvedValueOnce({
      id: 'user-1',
      firebaseUid: 'fb-uid-1',
      email: 'cashier@stoney.com',
      firstName: 'Kwame',
      lastName: 'Mensah',
      phone: '+233240000000',
      avatar: 'https://example.com/avatar.jpg',
      emailVerified: true,
      isActive: true,
      branchId: 'branch-1',
      branch: {
        id: 'branch-1',
        code: 'ACC-01',
        name: 'Accra Central',
        isActive: true,
      },
      roleId: 'role-1',
      role: {
        id: 'role-1',
        name: 'Cashier',
        description: 'Store Cashier',
      },
      permissions: ['sales:read', 'sales:create', 'payments:create'],
    });

    const req = new NextRequest('http://localhost:3000/api/v1/auth/me');
    const res = await GET(req, {});

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.user).toEqual({
      id: 'user-1',
      email: 'cashier@stoney.com',
      firstName: 'Kwame',
      lastName: 'Mensah',
      phone: '+233240000000',
      avatar: 'https://example.com/avatar.jpg',
      branchId: 'branch-1',
      branch: {
        id: 'branch-1',
        code: 'ACC-01',
        name: 'Accra Central',
        isActive: true,
      },
      role: {
        id: 'role-1',
        name: 'Cashier',
      },
      permissions: ['sales:read', 'sales:create', 'payments:create'],
    });
    // Ensure internal firebaseUid or raw emailVerified fields are omitted from public DTO
    expect(body.data.user.firebaseUid).toBeUndefined();
  });
});
