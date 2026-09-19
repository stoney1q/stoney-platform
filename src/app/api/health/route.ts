import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/observability/logger';
import { checkRateLimit } from '@/lib/rate-limit';

const HEALTH_LIMIT_MAX = 30;
const HEALTH_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

export async function GET(req: Request) {
  try {
    // Basic Rate Limiting
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';
    const rateLimit = await checkRateLimit(
      `health:ip:${ip}`,
      HEALTH_LIMIT_MAX,
      HEALTH_LIMIT_WINDOW_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { status: 'error', message: 'Too many requests' },
        { status: 429 }
      );
    }
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Health check failed', error);
    return NextResponse.json(
      { status: 'error', message: 'Database unreachable' },
      { status: 503 }
    );
  }
}
