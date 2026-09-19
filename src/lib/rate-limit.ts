import { prisma } from './prisma';
import { logger } from './observability/logger';

export interface RateLimitResult {
  allowed: boolean;
  locked: boolean;
  count: number;
}

/**
 * Checks a rate limit against the database.
 *
 * @param key Unique identifier (e.g. "ip:127.0.0.1:session" or "token:xyz")
 * @param limit Maximum number of allowed requests in the window
 * @param windowMs The time window in milliseconds
 * @param lockoutDurationMs Optional lockout duration if limit is exceeded
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  lockoutDurationMs?: number
): Promise<RateLimitResult> {
  try {
    const now = new Date();

    // We use a transaction to avoid severe race conditions where multiple
    // concurrent requests read the same initial state.
    return await prisma.$transaction(async (tx) => {
      let record = await tx.rateLimit.findUnique({
        where: { key },
      });

      if (record && record.expiresAt > now) {
        // Window is currently active

        // If we've already exceeded the limit in this window, we are locked out / rate limited.
        if (record.points > limit) {
          return {
            allowed: false,
            locked: lockoutDurationMs !== undefined,
            count: record.points,
          };
        }

        const newPoints = record.points + 1;
        let nextExpiresAt = record.expiresAt;

        // Apply lockout expiration if they just crossed the threshold
        if (newPoints > limit && lockoutDurationMs) {
          nextExpiresAt = new Date(now.getTime() + lockoutDurationMs);
        }

        record = await tx.rateLimit.update({
          where: { key },
          data: {
            points: newPoints,
            expiresAt: nextExpiresAt,
          },
        });

        return {
          allowed: newPoints <= limit,
          locked: newPoints > limit && lockoutDurationMs !== undefined,
          count: record.points,
        };
      } else {
        // Expired or new window
        const newExpiresAt = new Date(now.getTime() + windowMs);

        record = await tx.rateLimit.upsert({
          where: { key },
          update: {
            points: 1,
            expiresAt: newExpiresAt,
          },
          create: {
            key,
            points: 1,
            expiresAt: newExpiresAt,
          },
        });

        return { allowed: true, locked: false, count: 1 };
      }
    });
  } catch (error) {
    logger.error('Rate limit evaluation error', error, { key });
    // Fail open in case of DB failure to avoid completely bricking the app
    return { allowed: true, locked: false, count: 0 };
  }
}

/**
 * Cleanup expired rate limits.
 * Can be run periodically via cron or background job.
 */
export async function cleanupExpiredRateLimits() {
  try {
    await prisma.rateLimit.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  } catch (error) {
    logger.error('Failed to cleanup expired rate limits', error);
  }
}
