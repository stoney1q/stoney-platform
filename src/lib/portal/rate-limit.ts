type RateLimitRecord = {
  count: number;
  windowStart: number;
  lockedUntil?: number;
};

// In-memory stores for rate limiting.
// In a production multi-instance setup, this should be backed by Redis.
const ipLimits = new Map<string, RateLimitRecord>();
const tokenLimits = new Map<string, RateLimitRecord>();

const IP_LIMIT_MAX = 5;
const IP_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const TOKEN_LIMIT_MAX = 10;
const TOKEN_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const TOKEN_LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes lockout

function checkLimit(
  store: Map<string, RateLimitRecord>,
  key: string,
  max: number,
  windowMs: number,
  lockoutDurationMs?: number
): { allowed: boolean; locked: boolean } {
  const now = Date.now();
  const record = store.get(key) || { count: 0, windowStart: now };

  // Check if currently locked
  if (record.lockedUntil && now < record.lockedUntil) {
    return { allowed: false, locked: true };
  }

  // Reset window if it has passed (and not locked)
  if (now - record.windowStart > windowMs) {
    record.count = 0;
    record.windowStart = now;
  }

  record.count++;

  if (record.count > max) {
    // Apply lockout if configured
    if (lockoutDurationMs) {
      record.lockedUntil = now + lockoutDurationMs;
    }
    store.set(key, record);
    return { allowed: false, locked: !!lockoutDurationMs };
  }

  store.set(key, record);
  return { allowed: true, locked: false };
}

/**
 * Checks both the IP-based rate limit and the global Token-based rate limit.
 * Returns true if the attempt is allowed, false if blocked.
 */
export function checkPortalRateLimit(ip: string, portalToken: string): boolean {
  // 1. IP-Based Limiter (Prevent single IP from sweeping tokens)
  const ipResult = checkLimit(ipLimits, ip, IP_LIMIT_MAX, IP_LIMIT_WINDOW_MS);

  if (!ipResult.allowed) {
    return false;
  }

  // 2. Token-Based Global Limiter (Prevent distributed brute-forcing on one token)
  const tokenResult = checkLimit(
    tokenLimits,
    portalToken,
    TOKEN_LIMIT_MAX,
    TOKEN_LIMIT_WINDOW_MS,
    TOKEN_LOCKOUT_DURATION_MS
  );

  if (!tokenResult.allowed) {
    if (
      tokenResult.locked &&
      tokenLimits.get(portalToken)?.count === TOKEN_LIMIT_MAX + 1
    ) {
      // Trigger this only exactly when the threshold is crossed to avoid spamming logs
      console.warn(
        `[SECURITY] High volume of failed access attempts for document token: ${portalToken}. Token temporarily locked.`
      );
      // In a real system, you might also insert an AuditLog to the database here.
    }
    return false;
  }

  return true;
}

// For testing purposes
export function resetPortalRateLimits() {
  ipLimits.clear();
  tokenLimits.clear();
}

// Periodic cleanup of expired rate limits to prevent memory leaks
export function cleanupPortalRateLimits() {
  const now = Date.now();

  const cleanupStore = (
    store: Map<string, RateLimitRecord>,
    windowMs: number
  ) => {
    for (const [key, record] of store.entries()) {
      if (record.lockedUntil) {
        if (now > record.lockedUntil) {
          store.delete(key);
        }
        continue;
      }
      if (now - record.windowStart > windowMs) {
        store.delete(key);
      }
    }
  };

  cleanupStore(ipLimits, IP_LIMIT_WINDOW_MS);
  cleanupStore(
    tokenLimits,
    Math.max(TOKEN_LIMIT_WINDOW_MS, TOKEN_LOCKOUT_DURATION_MS)
  );
}

if (typeof setInterval !== 'undefined') {
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  const timer = setInterval(cleanupPortalRateLimits, CLEANUP_INTERVAL_MS);
  if (timer.unref) {
    timer.unref();
  }
}
