import { NextRequest } from 'next/server';
import { POST } from './route';
import { requirePermission } from '@/lib/auth/guard';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { streamText } from 'ai';
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';

vi.mock('@/lib/auth/guard');
vi.mock('@/lib/api/rate-limit');
vi.mock('ai');

describe('AI Chat API Route', () => {
  const mockRequirePermission = requirePermission as MockedFunction<typeof requirePermission>;
  const mockCheckRateLimit = checkRateLimit as MockedFunction<typeof checkRateLimit>;
  const mockStreamText = streamText as MockedFunction<typeof streamText>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRequirePermission.mockResolvedValue({
      id: 'user_123',
      branchId: 'branch_123',
      branch: { name: 'Main Branch' },
      permissions: ['ai:access', 'inventory:read'],
    } as never);

    mockCheckRateLimit.mockReturnValue(true);

    mockStreamText.mockResolvedValue({
      toDataStreamResponse: () => new Response('mock-stream'),
    } as never);
  });

  it('should reject requests without ai:access', async () => {
    mockRequirePermission.mockRejectedValueOnce(new Error('Access denied. Permission "ai:access" is required.'));

    const req = new NextRequest('http://localhost/api/v1/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500); // Because it throws a generic Error instead of AuthError here, it maps to 500
  });

  it('should reject oversized Content-Length early', async () => {
    const req = new NextRequest('http://localhost/api/v1/ai/chat', {
      method: 'POST',
      headers: {
        'content-length': '50001',
      },
      body: JSON.stringify({ messages: [] }), // Body doesn't matter, header is checked first
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('should handle successful request', async () => {
    const req = new NextRequest('http://localhost/api/v1/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Hello' }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockStreamText).toHaveBeenCalled();
  });

  it('should reject individual messages exceeding 4000 characters', async () => {
    const req = new NextRequest('http://localhost/api/v1/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'a'.repeat(4001) }],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid Request Body');
  });

  it('should handle simulated chunked request exceeding 50000 bytes', async () => {
    // We can simulate this by providing a large body and no Content-Length
    const largeBody = JSON.stringify({ messages: [{ role: 'user', content: 'a'.repeat(4000) }] }).padEnd(50001, ' ');
    const req = new NextRequest('http://localhost/api/v1/ai/chat', {
      method: 'POST',
      body: largeBody,
      headers: {
        // Omitting content-length to force stream buffering read logic
      },
      duplex: 'half'
    } as never);

    const res = await POST(req);
    expect(res.status).toBe(413);
    const data = await res.json();
    expect(data.error).toBe('Payload Too Large');
  });
});
