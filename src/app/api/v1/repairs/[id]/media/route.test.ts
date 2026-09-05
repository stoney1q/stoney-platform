import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getRepairMedia } from '@/lib/media/actions';
import { AuthError } from '@/lib/auth/guard';
import { MediaState } from '@/generated/prisma/client';

vi.mock('@/lib/media/actions', () => ({
  getRepairMedia: vi.fn(),
}));

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1' }),
    requirePermission: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Repair Media GET API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an id param', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/repairs//media');

    const res = await GET(req, { params: Promise.resolve({ id: '' }) });
    expect(res.status).toBe(400);
  });

  it('handles auth errors', async () => {
    vi.mocked(getRepairMedia).mockRejectedValueOnce(
      new AuthError('Forbidden', 403, 'FORBIDDEN')
    );

    const req = new NextRequest(
      'http://localhost:3000/api/v1/repairs/r1/media'
    );
    const res = await GET(req, { params: Promise.resolve({ id: 'r1' }) });

    expect(res.status).toBe(403);
  });

  it('returns media successfully', async () => {
    const mockMedia = [
      {
        id: 'm1',
        path: 'path/1',
        url: null,
        state: MediaState.READY,
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        fileName: '1.jpg',
        isPublic: false,
        createdById: 'u1',
        branchId: 'b1',
        productId: null,
        repairId: 'r1',
        createdAt: new Date(),
        updatedAt: new Date(),
        bucket: 'test-bucket',
      },
    ];
    vi.mocked(getRepairMedia).mockResolvedValueOnce(mockMedia);

    const req = new NextRequest(
      'http://localhost:3000/api/v1/repairs/r1/media'
    );
    const res = await GET(req, { params: Promise.resolve({ id: 'r1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.media).toHaveLength(1);
    expect(body.data.media[0].id).toBe('m1');
  });
});
