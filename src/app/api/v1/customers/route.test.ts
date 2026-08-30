import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import * as service from '@/lib/customers/service';
import { AuthError } from '@/lib/auth/guard';

vi.mock('@/lib/customers/service');

describe('Customers API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/customers', () => {
    it('enforces pagination bounds and returns 200', async () => {
      vi.mocked(service.searchCustomers).mockResolvedValue({
        success: true,
        error: undefined,
        data: {
          customers: [{ id: '1', firstName: 'John', lastName: 'Doe', createdById: 'secret' } as unknown as import('@/generated/prisma/client').Customer],
          totalCount: 1,
          totalPages: 1,
          currentPage: 1,
        },
      });

      const req = new NextRequest('http://localhost/api/v1/customers?limit=100000&page=-5');
      const res = await GET(req, {} as { params: Promise<Record<string, string>> });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(service.searchCustomers).toHaveBeenCalledWith({
        query: '',
        page: 1,
        limit: 100, // bounded
        activeOnly: true,
      });
      
      // Ensure safe DTO (no createdById)
      expect(json.data.customers[0].createdById).toBeUndefined();
      expect(json.data.customers[0].firstName).toBe('John');
    });

    it('returns 403 on AuthError', async () => {
      vi.mocked(service.searchCustomers).mockRejectedValue(
        new AuthError('Forbidden', 403, 'FORBIDDEN')
      );

      const req = new NextRequest('http://localhost/api/v1/customers');
      const res = await GET(req, {} as { params: Promise<Record<string, string>> });
      
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe('Forbidden');
    });
  });

  describe('POST /api/v1/customers', () => {
    it('returns 400 on Zod validation error', async () => {
      const req = new NextRequest('http://localhost/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({ firstName: '' }), // missing fields
      });

      const res = await POST(req, {} as { params: Promise<Record<string, string>> });
      
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Validation failed');
    });
    
    it('returns 409 when service returns warning', async () => {
      vi.mocked(service.createCustomer).mockResolvedValue({
        success: false,
        warning: { duplicateMatches: [] }
      });

      const req = new NextRequest('http://localhost/api/v1/customers', {
        method: 'POST',
        body: JSON.stringify({ firstName: 'John', lastName: 'Doe', email: 'test@test.com', isActive: true }),
      });

      const res = await POST(req, {} as { params: Promise<Record<string, string>> });
      
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.warning).toBeDefined();
    });
  });
});
