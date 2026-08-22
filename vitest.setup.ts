import 'dotenv/config';
import { vi } from 'vitest';

// Mock server-only to prevent it from throwing in Vitest Node environment
vi.mock('server-only', () => ({}));
