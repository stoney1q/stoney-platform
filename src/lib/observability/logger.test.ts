import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeContext, logger } from './logger';

describe('Observability Logger', () => {
  describe('sanitizeContext', () => {
    it('removes sensitive keys', () => {
      const input = {
        normalKey: 'visible',
        password: 'my-secret-password',
        token: 'auth-token-123',
        nested: {
          PAYSTACK_SECRET_KEY: 'sk_test_123',
          other: 'data',
        },
        arr: [{ secret: 'hidden' }, { safe: 'shown' }],
      };

      const result = sanitizeContext(input);

      expect(result).toEqual({
        normalKey: 'visible',
        password: '[REDACTED]',
        token: '[REDACTED]',
        nested: {
          PAYSTACK_SECRET_KEY: '[REDACTED]',
          other: 'data',
        },
        arr: [{ secret: '[REDACTED]' }, { safe: 'shown' }],
      });
    });

    it('handles null and arrays properly without crashing', () => {
      const input = {
        nullVal: null,
        arr: ['a', 'b', 'c'],
      };

      const result = sanitizeContext(input);
      expect(result).toEqual({
        nullVal: null,
        arr: ['a', 'b', 'c'],
      });
    });
  });

  describe('logger outputs', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'info').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('logs errors with correct context', () => {
      logger.error('Test error', new Error('Fail'), { userId: '123' });
      expect(console.error).toHaveBeenCalled();
    });

    it('logs info with correct context', () => {
      logger.info('Test info', { userId: '123' });
      expect(console.info).toHaveBeenCalled();
    });
  });
});
