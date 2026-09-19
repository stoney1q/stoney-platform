import { checkRateLimit } from '../rate-limit';
import { logger } from '../observability/logger';

const IP_LIMIT_MAX = 5;
const IP_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const TOKEN_LIMIT_MAX = 10;
const TOKEN_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const TOKEN_LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes lockout

/**
 * Checks both the IP-based rate limit and the global Token-based rate limit.
 * Returns true if the attempt is allowed, false if blocked.
 */
export async function checkPortalRateLimit(
  ip: string,
  portalToken: string
): Promise<boolean> {
  // 1. IP-Based Limiter (Prevent single IP from sweeping tokens)
  const ipKey = `portal:ip:${ip}`;
  const ipResult = await checkRateLimit(
    ipKey,
    IP_LIMIT_MAX,
    IP_LIMIT_WINDOW_MS
  );

  if (!ipResult.allowed) {
    return false;
  }

  // 2. Token-Based Global Limiter (Prevent distributed brute-forcing on one token)
  const tokenKey = `portal:token:${portalToken}`;
  const tokenResult = await checkRateLimit(
    tokenKey,
    TOKEN_LIMIT_MAX,
    TOKEN_LIMIT_WINDOW_MS,
    TOKEN_LOCKOUT_DURATION_MS
  );

  if (!tokenResult.allowed) {
    if (tokenResult.locked && tokenResult.count === TOKEN_LIMIT_MAX + 1) {
      // Trigger this only exactly when the threshold is crossed to avoid spamming logs
      logger.warn(
        `[SECURITY] High volume of failed access attempts for document token: ${portalToken}. Token temporarily locked.`,
        { portalToken, ip }
      );
    }
    return false;
  }

  return true;
}

// For testing purposes
export function resetPortalRateLimits() {
  // With DB-backed rate limits, tests should reset the DB.
  // This is a no-op now.
}

export function cleanupPortalRateLimits() {
  // Handled by global cleanup
}
