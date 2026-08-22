import 'dotenv/config';
import { describe, it } from 'vitest';
import assert from 'node:assert';
import { Decimal } from 'decimal.js';
import {
  calculateLineSubtotal,
  calculateLineTotal,
  calculateDocumentSubtotal,
  isValidDiscount,
} from './math';

describe('Pricing Math Utilities', () => {
  describe('calculateLineSubtotal', () => {
    it('should correctly calculate subtotal for simple numbers', () => {
      const result = calculateLineSubtotal(10.5, 2);
      assert.strictEqual(result.toString(), '21');
    });

    it('should handle decimal precision correctly without floating point errors', () => {
      // 0.1 * 3 in JS is 0.30000000000000004
      const result = calculateLineSubtotal(0.1, 3);
      assert.strictEqual(result.toString(), '0.3');
    });

    it('should accept strings, numbers, and Decimal inputs', () => {
      assert.strictEqual(calculateLineSubtotal('15.99', 2).toString(), '31.98');
      assert.strictEqual(calculateLineSubtotal(15.99, 2).toString(), '31.98');
      assert.strictEqual(
        calculateLineSubtotal(new Decimal(15.99), 2).toString(),
        '31.98'
      );
    });
  });

  describe('calculateLineTotal', () => {
    it('should subtract discount from subtotal', () => {
      const result = calculateLineTotal(100, 15);
      assert.strictEqual(result.toString(), '85');
    });

    it('should return 0 if discount is greater than subtotal', () => {
      const result = calculateLineTotal(100, 150);
      assert.strictEqual(result.toString(), '0');
    });

    it('should handle floating point math exactly', () => {
      // 0.3 - 0.2 is 0.09999999999999998 in standard JS
      const result = calculateLineTotal(0.3, 0.2);
      assert.strictEqual(result.toString(), '0.1');
    });
  });

  describe('calculateDocumentSubtotal', () => {
    it('should sum up all line totals exactly', () => {
      const items = [
        { total: 10.5 },
        { total: '20.25' },
        { total: new Decimal(5.1) },
      ];

      const result = calculateDocumentSubtotal(items);
      assert.strictEqual(result.toString(), '35.85');
    });

    it('should return 0 for an empty array', () => {
      const result = calculateDocumentSubtotal([]);
      assert.strictEqual(result.toString(), '0');
    });
  });

  describe('isValidDiscount', () => {
    it('should return true if discount is strictly less than subtotal', () => {
      assert.strictEqual(isValidDiscount(100, 50), true);
    });

    it('should return true if discount equals subtotal', () => {
      assert.strictEqual(isValidDiscount(100, 100), true);
    });

    it('should return false if discount is greater than subtotal', () => {
      assert.strictEqual(isValidDiscount(100, 101), false);
    });

    it('should return false if discount is negative', () => {
      assert.strictEqual(isValidDiscount(100, -10), false);
    });
  });
});
