import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import prisma from '@/lib/prisma';

const mockVerifyIdToken = vi.fn();
const mockCreateSessionCookie = vi.fn();

vi.mock('@/lib/firebase/admin', () => ({
  isFirebaseAdminConfigured: vi.fn(() => true),
  getFirebaseAdminAuth: vi.fn(() => ({
    verifyIdToken: mockVerifyIdToken,
    createSessionCookie: mockCreateSessionCookie,
  })),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
  })),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => Promise.resolve({ allowed: true })),
}));

vi.mock('@/lib/auth/guard', () => ({
  getCurrentUser: vi.fn(() => Promise.resolve({ id: 'user-1' })),
}));

describe('POST /api/auth/session (Account Linking)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects account linking if the incoming ID token has an unverified email', async () => {
    // 1. Simulate an unverified identity
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'attacker-firebase-uid',
      email: 'admin@stoney.com',
      email_verified: false,
    });

    // 2. Simulate the Stoney database state: a provisioned user exists but is not linked
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null) // First check by firebaseUid fails (not linked)
      .mockResolvedValueOnce({
        id: 'admin-user-id',
        email: 'admin@stoney.com',
        firebaseUid: null,
        isActive: true,
      } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>); // Second check by email finds the provisioned user

    const req = new Request('http://localhost:3000/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'fake-id-token' }),
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    
    expect(body.error).toContain('Email address must be verified to link');
    expect(body.code).toBe('UNVERIFIED_EMAIL');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows account linking if the incoming ID token has a verified email', async () => {
    // 1. Simulate a verified identity (e.g., from Google Sign-In)
    mockVerifyIdToken.mockResolvedValueOnce({
      uid: 'legit-firebase-uid',
      email: 'admin@stoney.com',
      email_verified: true,
    });

    // 2. Simulate the Stoney database state: a provisioned user exists but is not linked
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(null) // First check by firebaseUid fails (not linked)
      .mockResolvedValueOnce({
        id: 'admin-user-id',
        email: 'admin@stoney.com',
        firebaseUid: null,
        isActive: true,
      } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>); // Second check by email finds the provisioned user

    vi.mocked(prisma.user.update).mockResolvedValueOnce({
      id: 'admin-user-id',
      email: 'admin@stoney.com',
      firebaseUid: 'legit-firebase-uid',
      isActive: true,
    } as unknown as NonNullable<Awaited<ReturnType<typeof prisma.user.update>>>);

    mockCreateSessionCookie.mockResolvedValueOnce('mock-session-cookie');

    const req = new Request('http://localhost:3000/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ idToken: 'fake-id-token' }),
      headers: { 'x-forwarded-for': '127.0.0.1' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify it updated the database to link the account
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'admin-user-id' },
      data: {
        firebaseUid: 'legit-firebase-uid',
        emailVerified: true,
      },
    });
  });
});
