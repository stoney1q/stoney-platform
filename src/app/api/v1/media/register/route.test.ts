import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { registerMedia } from '@/lib/media/actions';
import { AuthError } from '@/lib/auth/guard';

vi.mock('@/lib/media/actions', () => ({
  registerMedia: vi.fn(),
}));

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1' }),
  };
});

describe('Register Media API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid schema', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/media/register', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('handles authorization errors', async () => {
    vi.mocked(registerMedia).mockRejectedValueOnce(
      new AuthError('Unauthorized', 401, 'UNAUTHORIZED')
    );

    const req = new NextRequest('http://localhost:3000/api/v1/media/register', {
      method: 'POST',
      body: JSON.stringify({ assetId: 'a1' }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });

  it('registers media successfully', async () => {
    vi.mocked(registerMedia).mockResolvedValueOnce(undefined);

    const req = new NextRequest('http://localhost:3000/api/v1/media/register', {
      method: 'POST',
      body: JSON.stringify({ assetId: 'a1' }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });
});
