# Loop 34: Observability Configuration

## Centralized Logging

STONEY now uses a unified observability facade (`src/lib/observability/logger.ts`) for all server-side operations, API routes, and background jobs.

### Environment Behavior

- **Development** (`NODE_ENV=development`): The logger outputs human-readable strings to standard out/err via standard `console`.
- **Production** (`NODE_ENV=production`): The logger outputs strictly formatted JSON (e.g. `{"level":"error","message":"...","context":{...}}`). These logs are automatically picked up, parsed, and indexed by Cloud Providers (such as Vercel Log Explorer, Google Cloud Logging, AWS CloudWatch) without requiring external agents.

### Data Privacy & Sanitization

The logger automatically intercepts and redacts any properties passed via context whose keys resemble sensitive fields:

- `password`, `secret`, `token`, `authorization`, `signature`, `cookie`, `paystack_secret_key`, `portaltoken`.
  These values will appear as `[REDACTED]` in production logs.

### Usage

```ts
import { logger } from '@/lib/observability/logger';

// Info level, used for tracking major milestones (e.g., job completion)
logger.info('Payment processed', { reference: 'pay_123' });

// Warn level, used for suspicious behavior or non-fatal issues
logger.warn('Rate limit exceeded', { ip: '127.0.0.1' });

// Error level, requires an Error object to capture the message and stack trace securely
logger.error('Background task failed', error, { taskId: 'abc-123' });
```

## Health Checks

A new endpoint `/api/health` has been introduced.

- **Method**: `GET`
- **Behavior**: Executes a lightweight query (`SELECT 1`) against the primary Prisma database to confirm connectivity.
- **Usage**: Load balancers (e.g. Google Cloud HTTP(s) Load Balancer) and uptime monitors (e.g. BetterStack, Datadog) should point to this URL.

## External Trackers

If a requirement arises for a more advanced Error tracking tool (e.g., Sentry, Datadog APM), integration is straightforward. `src/lib/observability/logger.ts` is the sole file that needs to be updated. You can wrap `Sentry.captureException(error, { extra: context })` directly inside the `log` function for production mode.
