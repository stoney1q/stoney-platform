import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { generateUploadUrl } from '@/lib/media/actions';
import { AuthError } from '@/lib/auth/guard';

vi.mock('@/lib/media/actions', () => ({
  generateUploadUrl: vi.fn(),
}));

vi.mock('@/lib/auth/guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/guard')>();
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({ id: 'u1' }),
    requirePermission: vi.fn().mockResolvedValue(undefined),
  };
});

describe('Upload URL API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects invalid schema (missing fields)', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/v1/media/upload-url',
      {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'product',
          // missing entityId, mimeType, etc.
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Validation failed');
  });

  it('rejects invalid entityType', async () => {
    const req = new NextRequest(
      'http://localhost:3000/api/v1/media/upload-url',
      {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'invalid',
          entityId: 'p1',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          fileName: 'test.jpg',
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('handles authorization errors from action', async () => {
    vi.mocked(generateUploadUrl).mockRejectedValueOnce(
      new AuthError('Forbidden', 403, 'FORBIDDEN')
    );

    const req = new NextRequest(
      'http://localhost:3000/api/v1/media/upload-url',
      {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'product',
          entityId: 'p1',
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          fileName: 'test.jpg',
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('handles general errors from action', async () => {
    vi.mocked(generateUploadUrl).mockRejectedValueOnce(
      new Error('File size exceeds the 5MB limit.')
    );

    const req = new NextRequest(
      'http://localhost:3000/api/v1/media/upload-url',
      {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'product',
          entityId: 'p1',
          mimeType: 'image/jpeg',
          sizeBytes: 10000000,
          fileName: 'test.jpg',
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it('returns upload URL successfully', async () => {
    vi.mocked(generateUploadUrl).mockResolvedValueOnce({
      uploadUrl: 'https://storage.example.com/upload?sig=123',
      assetId: 'asset-1',
    });

    const req = new NextRequest(
      'http://localhost:3000/api/v1/media/upload-url',
      {
        method: 'POST',
        body: JSON.stringify({
          entityType: 'repair',
          entityId: 'r1',
          mimeType: 'image/png',
          sizeBytes: 2048,
          fileName: 'broken.png',
        }),
      }
    );

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.uploadUrl).toBe(
      'https://storage.example.com/upload?sig=123'
    );
    expect(body.data.assetId).toBe('asset-1');
  });
});
