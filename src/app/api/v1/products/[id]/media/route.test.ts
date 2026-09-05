import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';
import { getProductMedia } from '@/lib/media/actions';
import { AuthError } from '@/lib/auth/guard';
import { MediaState } from '@/generated/prisma/client';

vi.mock('@/lib/media/actions', () => ({
  getProductMedia: vi.fn(),
}));

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1' }),
    requirePermission: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Product Media GET API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an id param', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/products//media');

    const res = await GET(req, { params: Promise.resolve({ id: '' }) });
    expect(res.status).toBe(400);
  });

  it('handles auth errors', async () => {
    vi.mocked(getProductMedia).mockRejectedValueOnce(
      new AuthError('Forbidden', 403, 'FORBIDDEN')
    );

    const req = new NextRequest(
      'http://localhost:3000/api/v1/products/p1/media'
    );
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(403);
  });

  it('returns media successfully', async () => {
    const mockMedia = [
      {
        id: 'm1',
        path: 'path/1',
        url: 'http://url/1',
        state: MediaState.READY,
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        fileName: '1.jpg',
        isPublic: true,
        createdById: 'u1',
        branchId: null,
        productId: 'p1',
        repairId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        bucket: 'test-bucket',
      },
    ];
    vi.mocked(getProductMedia).mockResolvedValueOnce(mockMedia);

    const req = new NextRequest(
      'http://localhost:3000/api/v1/products/p1/media'
    );
    const res = await GET(req, { params: Promise.resolve({ id: 'p1' }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.media).toHaveLength(1);
    expect(body.data.media[0].id).toBe('m1');
  });
});
