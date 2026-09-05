import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE } from './route';
import { deleteMedia } from '@/lib/media/actions';
import { AuthError } from '@/lib/auth/guard';

vi.mock('@/lib/media/actions', () => ({
  deleteMedia: vi.fn(),
}));

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1' }),
  };
});

describe('Delete Media API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an id param', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/media/');

    // Simulating no ID from next param router
    const res = await DELETE(req, { params: Promise.resolve({ id: '' }) });
    expect(res.status).toBe(400);
  });

  it('handles auth errors', async () => {
    vi.mocked(deleteMedia).mockRejectedValueOnce(
      new AuthError('Forbidden', 403, 'FORBIDDEN')
    );

    const req = new NextRequest('http://localhost:3000/api/v1/media/asset-1');
    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'asset-1' }),
    });

    expect(res.status).toBe(403);
  });

  it('deletes media successfully', async () => {
    vi.mocked(deleteMedia).mockResolvedValueOnce(undefined);

    const req = new NextRequest('http://localhost:3000/api/v1/media/asset-1');
    const res = await DELETE(req, {
      params: Promise.resolve({ id: 'asset-1' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
    expect(deleteMedia).toHaveBeenCalledWith('asset-1');
  });
});
